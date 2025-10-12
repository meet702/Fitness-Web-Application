package com.fitness.activityService.Service;

import com.fitness.activityService.DTO.ActivityRequest;
import com.fitness.activityService.DTO.ActivityResponse;
import com.fitness.activityService.Model.Activity;
import com.fitness.activityService.Repository.ActivityRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor       // To use required Args cons final keyword should be added before definition of an object
public class ActivityService {

    private final ActivityRepository repository;
    private final userValidationService userValidationService;
    private final RabbitTemplate rabbitTemplate;

    @Value("${rabbitmq.exchange.name}")
    private String exchange;

    @Value("${rabbitmq.routing.key}")
    private String routingKey;

    public ActivityResponse trackActivity(ActivityRequest request) {

        boolean validateUser = userValidationService.validateUser(request.getUserId());
        if(!validateUser) {
            throw new RuntimeException("Invalid User: " + request.getUserId());
        }
        Activity activity = Activity.builder()      // Same as this below one which we used in UserService
                .userId(request.getUserId())        //activity.setUserId(request.getUserId());
                .type(request.getType())
                .duration(request.getDuration())
                .caloriesBurned(request.getCaloriesBurned())
                .startTime(request.getStartTime())
                .additionalMetrics(request.getAdditionalMetrics())
                .build();

        Activity savedActivity = repository.save(activity);
        // Publish to RabbitMQ to for AI processing
        try{
            rabbitTemplate.convertAndSend(exchange, routingKey, savedActivity);
        }
        catch(Exception e) {
            log.error("Failed to publish activity to Rabbit: ", e);
        }
        return mapToResponse(savedActivity);
    }

    private ActivityResponse mapToResponse(Activity activity){
        ActivityResponse response = new ActivityResponse();
        response.setId(activity.getId());
        response.setUserId(activity.getUserId());
        response.setType(activity.getType());
        response.setDuration(activity.getDuration());
        response.setCaloriesBurned(activity.getCaloriesBurned());
        response.setStartTime(activity.getStartTime());
        response.setAdditionalMetrics(activity.getAdditionalMetrics());
        response.setCreatedAt(activity.getCreatedAt());
        response.setUpdatedAt(activity.getUpdatedAt());

        return response;
    }

    public List<ActivityResponse> getUserActivities(String userId) {
        List<Activity> activities = repository.findByUserId(userId);

        List<ActivityResponse> responses = new ArrayList<>();
        for(Activity activity : activities){
            responses.add(mapToResponse(activity));
        }
        return responses;

        // Alternative way to write above piece of code
//        return activities.stream()
//                .map(this::mapToResponse)
//                .collect(Collectors.toList());
    }

    public ActivityResponse getActivityById(String activityId) {
        Activity activity = repository.findById(activityId)
                .orElseThrow(() -> new RuntimeException("No such activity found with id: " + activityId));
        Activity savedActivity = repository.save(activity);
        return mapToResponse(savedActivity);

        // Alternative way
//        return repository.findById(activityId)
//                .map(this::mapToResponse)
//                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No such activity found with id: " + activityId));
    }
}
