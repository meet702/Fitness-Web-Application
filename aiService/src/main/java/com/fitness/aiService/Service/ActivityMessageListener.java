package com.fitness.aiService.Service;

import com.fitness.aiService.Model.Activity;
import com.fitness.aiService.Model.Recommendations;
import com.fitness.aiService.Repository.RecommendationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Service;

@Service
@Slf4j
@RequiredArgsConstructor
public class ActivityMessageListener {

    private final ActivityAiService aiService;
    private final RecommendationRepository recommendationRepository;

    @RabbitListener(queues = "activity.queue")
    public void processActivity(Activity activity){
        log.info("Activity received for activity ID: {}", activity.getId());
        Recommendations recommendations = aiService.generateRecommendation(activity);
        log.info("FINAL RECOMMENDATIONS BEFORE SAVE: {}", recommendations);
        recommendationRepository.save(recommendations);
    }
}
