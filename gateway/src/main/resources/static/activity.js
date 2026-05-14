// ===== Activity Page Logic =====
(function () {
  if (!requireAuth()) return;
  renderNavbar('activity');

  // Set default start time to now
  const now = new Date();
  const tzOffset = now.getTimezoneOffset() * 60000;
  const localISO = new Date(now - tzOffset).toISOString().slice(0, 16);
  document.getElementById('startTime').value = localISO;

  // ===== Activity Type Grid =====
  const typeGrid = document.getElementById('typeGrid');
  const typeInput = document.getElementById('activityType');
  let selectedType = '';

  ACTIVITY_TYPES.forEach(t => {
    const tile = document.createElement('div');
    tile.className = 'type-tile';
    tile.innerHTML = `<span class="type-emoji">${t.emoji}</span>${t.label}`;
    tile.addEventListener('click', () => {
      document.querySelectorAll('.type-tile').forEach(el => el.classList.remove('selected'));
      tile.classList.add('selected');
      selectedType = t.value;
      typeInput.value = t.value;
    });
    typeGrid.appendChild(tile);
  });

  // Select first by default
  typeGrid.children[0].click();

  // ===== Metrics =====
  let metrics = {};
  const chipsContainer = document.getElementById('metricsChips');
  const metricKeyInput = document.getElementById('metricKey');
  const metricValInput = document.getElementById('metricVal');

  document.getElementById('addMetricBtn').addEventListener('click', () => {
    const k = metricKeyInput.value.trim();
    const v = metricValInput.value.trim();
    if (!k || !v) return;
    metrics[k] = v;
    metricKeyInput.value = '';
    metricValInput.value = '';
    renderChips();
  });

  function renderChips() {
    chipsContainer.innerHTML = Object.entries(metrics).map(([k, v]) =>
      `<span class="metric-chip">${k}: ${v} <button type="button" onclick="removeMetric('${k}')">&times;</button></span>`
    ).join('');
  }

  window.removeMetric = function (key) {
    delete metrics[key];
    renderChips();
  };

  // ===== Clear =====
  document.getElementById('clearBtn').addEventListener('click', () => {
    document.getElementById('activityForm').reset();
    document.getElementById('startTime').value = localISO;
    metrics = {};
    renderChips();
    typeGrid.children[0].click();
  });

  // ===== Form Submit =====
  const form = document.getElementById('activityForm');
  const formError = document.getElementById('formError');
  const submitBtn = document.getElementById('submitBtn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    formError.classList.add('hidden');

    if (!selectedType) {
      formError.textContent = 'Please select an activity type';
      formError.classList.remove('hidden');
      return;
    }

    const duration = parseInt(document.getElementById('duration').value);
    const calories = parseInt(document.getElementById('calories').value);
    const startTime = document.getElementById('startTime').value;

    if (!duration || duration < 1) {
      formError.textContent = 'Duration must be at least 1 minute';
      formError.classList.remove('hidden');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Logging...';

    const userId = getUserId();
    const payload = {
      userId: userId,
      type: selectedType,
      duration: duration,
      caloriesBurned: calories || 0,
      startTime: startTime ? startTime + ':00' : new Date().toISOString(),
      additionalMetrics: Object.keys(metrics).length > 0 ? metrics : null
    };

    try {
      const result = await apiFetch('/api/activities', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      showToast('Activity logged successfully! 🎉', 'success');
      submitBtn.disabled = false;
      submitBtn.textContent = '🏋️ Log Activity';

      // Reset form
      form.reset();
      document.getElementById('startTime').value = localISO;
      metrics = {};
      renderChips();
      typeGrid.children[0].click();

      // Try to fetch recommendation
      const activityId = result.id || result.Id;
      if (activityId) {
        fetchRecommendation(activityId);
      }
    } catch (err) {
      console.error('Activity submit error:', err);
      formError.textContent = 'Failed to log activity: ' + err.message;
      formError.classList.remove('hidden');
      submitBtn.disabled = false;
      submitBtn.textContent = '🏋️ Log Activity';
      showToast('Failed to log activity', 'error');
    }
  });

  // ===== Recommendation =====
  async function fetchRecommendation(activityId) {
    const container = document.getElementById('recResult');
    container.innerHTML = `
      <div class="loading-overlay">
        <div class="spinner"></div>
        <span>AI is analyzing your activity...</span>
        <span style="font-size:0.8rem;color:var(--text-muted)">This may take a few seconds</span>
      </div>`;

    // Poll for recommendation (AI processes async via RabbitMQ)
    let attempts = 0;
    const maxAttempts = 10;
    const pollInterval = 3000;

    async function poll() {
      attempts++;
      try {
        const rec = await apiFetch(`/api/recommendations/activity/${activityId}`);
        renderFullRec(container, rec);
        showToast('AI recommendation ready! 🤖', 'success');
      } catch (err) {
        if (attempts < maxAttempts) {
          container.innerHTML = `
            <div class="loading-overlay">
              <div class="spinner"></div>
              <span>AI is analyzing your activity...</span>
              <span style="font-size:0.8rem;color:var(--text-muted)">Attempt ${attempts}/${maxAttempts}</span>
            </div>`;
          setTimeout(poll, pollInterval);
        } else {
          container.innerHTML = `
            <div class="empty-state">
              <div class="empty-icon">⏳</div>
              <h3>Processing</h3>
              <p>The AI is still processing your activity. Check the dashboard later for your recommendation.</p>
              <a href="/dashboard.html" class="btn btn-primary mt-2">Go to Dashboard</a>
            </div>`;
        }
      }
    }

    // Wait a bit before first poll
    setTimeout(poll, 2000);
  }

  function renderFullRec(container, rec) {
    let html = '<div style="padding:4px;">';

    html += `<div class="flex items-center gap-2 mb-3">
      <span style="font-size:1.5rem">🤖</span>
      <div>
        <h3 style="margin:0;font-size:1.1rem;">AI Analysis</h3>
        <span class="badge badge-purple">${rec.activityType || 'Activity'}</span>
      </div>
    </div>`;

    if (rec.recommendation) {
      html += `<div class="rec-section"><h4>📝 Overall Analysis</h4><div class="rec-text">${rec.recommendation.replace(/\n/g, '<br>')}</div></div>`;
    }
    if (rec.improvements && rec.improvements.length) {
      html += `<div class="rec-section"><h4>📈 Areas for Improvement</h4><ul class="rec-list improvements">${rec.improvements.map(i => `<li>${i}</li>`).join('')}</ul></div>`;
    }
    if (rec.suggestions && rec.suggestions.length) {
      html += `<div class="rec-section"><h4>💡 Workout Suggestions</h4><ul class="rec-list suggestions">${rec.suggestions.map(s => `<li>${s}</li>`).join('')}</ul></div>`;
    }
    if (rec.safety && rec.safety.length) {
      html += `<div class="rec-section"><h4>⚠️ Safety Guidelines</h4><ul class="rec-list safety">${rec.safety.map(s => `<li>${s}</li>`).join('')}</ul></div>`;
    }

    html += '</div>';
    container.innerHTML = html;
  }

})();
