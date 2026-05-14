// ===== Dashboard Logic =====
(function () {
  if (!requireAuth()) return;
  renderNavbar('dashboard');

  // Greeting
  const hour = new Date().getHours();
  const greetEl = document.getElementById('greeting');
  const name = getUserDisplayName();
  if (hour < 12) greetEl.textContent = 'Good morning, ' + name;
  else if (hour < 18) greetEl.textContent = 'Good afternoon, ' + name;
  else greetEl.textContent = 'Good evening, ' + name;

  let allActivities = [];

  loadDashboard();

  async function loadDashboard() {
    try {
      allActivities = await loadActivities();
      renderStats(allActivities);
      renderActivitiesList(allActivities);
      renderChart(allActivities);
      loadRecommendations();
    } catch (err) {
      console.error('Dashboard load error:', err);
      showToast('Failed to load dashboard data', 'error');
    }
  }

  async function loadActivities() {
    const userId = getUserId();
    const headers = {};
    if (userId) headers['X-User-ID'] = userId;
    try {
      const data = await apiFetch('/api/activities', { method: 'GET', headers });
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.error('Load activities error:', err);
      return [];
    }
  }

  function renderStats(activities) {
    document.getElementById('totalActivities').textContent = activities.length;
    const totalCal = activities.reduce((s, a) => s + (a.caloriesBurned || 0), 0);
    document.getElementById('totalCalories').textContent = totalCal.toLocaleString();
    const totalDur = activities.reduce((s, a) => s + (a.duration || 0), 0);
    document.getElementById('totalDuration').textContent = totalDur.toLocaleString();

    // Find top activity type
    const typeCounts = {};
    activities.forEach(a => {
      const t = a.type || 'OTHER';
      typeCounts[t] = (typeCounts[t] || 0) + 1;
    });
    const topType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0];
    document.getElementById('topActivity').textContent = topType ? getActivityLabel(topType[0]) : '—';
  }

  function renderActivitiesList(activities) {
    const container = document.getElementById('activitiesList');
    if (activities.length === 0) {
      container.innerHTML = `
        <div class="empty-state glass-static">
          <div class="empty-icon">🏃</div>
          <h3>No activities yet</h3>
          <p>Start logging your workouts to see them here</p>
          <a href="/activity.html" class="btn btn-primary">Log Your First Activity</a>
        </div>`;
      return;
    }

    // Show most recent first (up to 10)
    const sorted = [...activities].sort((a, b) =>
      new Date(b.startTime || b.createdAt) - new Date(a.startTime || a.createdAt)
    ).slice(0, 10);

    container.innerHTML = sorted.map(a => `
      <div class="activity-card glass" onclick="openActivityDetail('${a.id || a.Id}')">
        <div class="activity-info">
          <div class="activity-type-icon">${getActivityEmoji(a.type)}</div>
          <div>
            <div class="activity-name">${getActivityLabel(a.type)}</div>
            <div class="activity-meta">${formatDateTime(a.startTime || a.createdAt)}</div>
          </div>
        </div>
        <div class="activity-stats">
          <div class="activity-stat">
            <div class="activity-stat-value">${a.duration || 0}<span style="font-size:0.7rem;font-weight:400;color:var(--text-muted)"> min</span></div>
            <div class="activity-stat-label">Duration</div>
          </div>
          <div class="activity-stat">
            <div class="activity-stat-value">${a.caloriesBurned || 0}<span style="font-size:0.7rem;font-weight:400;color:var(--text-muted)"> kcal</span></div>
            <div class="activity-stat-label">Calories</div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();fetchRecForActivity('${a.id || a.Id}')">✨ AI</button>
        </div>
      </div>
    `).join('');
  }

  function renderChart(activities) {
    const container = document.getElementById('chartContainer');
    if (activities.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-icon">📊</div><p>No data to display yet</p></div>';
      return;
    }

    const typeCounts = {};
    activities.forEach(a => {
      const t = a.type || 'OTHER';
      typeCounts[t] = (typeCounts[t] || 0) + 1;
    });

    const sorted = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
    const max = sorted[0][1];

    container.innerHTML = `<div class="chart-bar-group">${sorted.map(([type, count]) => {
      const pct = Math.max(8, (count / max) * 100);
      return `
        <div class="chart-bar-row">
          <div class="chart-bar-label">${getActivityEmoji(type)} ${getActivityLabel(type)}</div>
          <div class="chart-bar-track">
            <div class="chart-bar-fill" style="width:${pct}%">${count}</div>
          </div>
        </div>`;
    }).join('')}</div>`;
  }

  async function loadRecommendations() {
    const container = document.getElementById('recsContainer');
    const userId = getUserId();
    if (!userId || userId === 'guest') {
      container.innerHTML = '<div class="empty-state"><div class="empty-icon">✨</div><p>Log an activity to get AI recommendations</p></div>';
      return;
    }
    try {
      const recs = await apiFetch(`/api/recommendations/user/${userId}`);
      if (!Array.isArray(recs) || recs.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">✨</div><p>No recommendations yet. Log an activity!</p></div>';
        return;
      }
      const latest = recs[recs.length - 1];
      renderRecPanel(container, latest);
    } catch (err) {
      container.innerHTML = '<div class="empty-state"><div class="empty-icon">✨</div><p>Could not load recommendations</p></div>';
    }
  }

  function renderRecPanel(container, rec) {
    let html = '';
    if (rec.recommendation) {
      html += `<div class="rec-section"><h4>📝 Analysis</h4><div class="rec-text">${rec.recommendation}</div></div>`;
    }
    if (rec.improvements && rec.improvements.length) {
      html += `<div class="rec-section"><h4>📈 Improvements</h4><ul class="rec-list improvements">${rec.improvements.map(i => `<li>${i}</li>`).join('')}</ul></div>`;
    }
    if (rec.suggestions && rec.suggestions.length) {
      html += `<div class="rec-section"><h4>💡 Suggestions</h4><ul class="rec-list suggestions">${rec.suggestions.map(s => `<li>${s}</li>`).join('')}</ul></div>`;
    }
    if (rec.safety && rec.safety.length) {
      html += `<div class="rec-section"><h4>⚠️ Safety</h4><ul class="rec-list safety">${rec.safety.map(s => `<li>${s}</li>`).join('')}</ul></div>`;
    }
    container.innerHTML = html || '<p class="rec-text">No detailed data available.</p>';
  }

  // ===== Detail Panel =====
  const detailPanel = document.getElementById('detailPanel');
  const detailOverlay = document.getElementById('detailOverlay');
  const detailClose = document.getElementById('detailClose');
  const detailContent = document.getElementById('detailContent');

  function closeDetail() {
    detailPanel.classList.remove('open');
    detailOverlay.classList.remove('open');
  }
  detailClose.addEventListener('click', closeDetail);
  detailOverlay.addEventListener('click', closeDetail);

  window.openActivityDetail = async function (activityId) {
    detailPanel.classList.add('open');
    detailOverlay.classList.add('open');
    detailContent.innerHTML = '<div class="loading-overlay"><div class="spinner"></div><span>Loading...</span></div>';
    document.getElementById('detailTitle').textContent = 'Activity Details';

    try {
      const activity = await apiFetch(`/api/activities/${activityId}`);
      let html = `
        <div class="glass-static" style="padding:20px;margin-bottom:16px;">
          <div class="flex items-center gap-2 mb-2">
            <span style="font-size:2rem">${getActivityEmoji(activity.type)}</span>
            <div>
              <h3 style="margin:0">${getActivityLabel(activity.type)}</h3>
              <span class="badge badge-purple">${activity.type}</span>
            </div>
          </div>
          <div class="stats-grid" style="margin-top:16px">
            <div style="text-align:center">
              <div style="font-size:1.3rem;font-weight:700" class="text-gradient">${activity.duration || 0}</div>
              <div style="font-size:0.75rem;color:var(--text-muted)">MINUTES</div>
            </div>
            <div style="text-align:center">
              <div style="font-size:1.3rem;font-weight:700" class="text-gradient">${activity.caloriesBurned || 0}</div>
              <div style="font-size:0.75rem;color:var(--text-muted)">CALORIES</div>
            </div>
          </div>
          <div style="margin-top:14px;font-size:0.85rem;color:var(--text-secondary)">
            <div>📅 ${formatDateTime(activity.startTime)}</div>
            ${activity.additionalMetrics ? `<div style="margin-top:8px">📎 Metrics: ${JSON.stringify(activity.additionalMetrics)}</div>` : ''}
          </div>
        </div>
        <button class="btn btn-primary w-full mb-2" onclick="fetchRecForActivityDetail('${activityId}')">✨ Get AI Recommendation</button>
        <div id="detailRec"></div>
      `;
      detailContent.innerHTML = html;
    } catch (err) {
      detailContent.innerHTML = `<div class="empty-state"><div class="empty-icon">😕</div><p>Could not load activity details</p></div>`;
    }
  };

  window.fetchRecForActivityDetail = async function (activityId) {
    const recDiv = document.getElementById('detailRec');
    recDiv.innerHTML = '<div class="loading-overlay"><div class="spinner"></div><span>Fetching AI recommendation...</span></div>';
    try {
      const rec = await apiFetch(`/api/recommendations/activity/${activityId}`);
      renderRecPanel(recDiv, rec);
      showToast('Recommendation loaded!', 'success');
    } catch (err) {
      recDiv.innerHTML = `<div class="empty-state"><p>No recommendation available yet. The AI may still be processing.</p></div>`;
    }
  };

  window.fetchRecForActivity = async function (activityId) {
    const container = document.getElementById('recsContainer');
    container.innerHTML = '<div class="loading-overlay"><div class="spinner"></div><span>Fetching recommendation...</span></div>';
    try {
      const rec = await apiFetch(`/api/recommendations/activity/${activityId}`);
      renderRecPanel(container, rec);
      showToast('Recommendation loaded!', 'success');
    } catch (err) {
      container.innerHTML = '<div class="empty-state"><div class="empty-icon">✨</div><p>No recommendation available yet.</p></div>';
      showToast('Recommendation not ready yet', 'info');
    }
  };

})();
