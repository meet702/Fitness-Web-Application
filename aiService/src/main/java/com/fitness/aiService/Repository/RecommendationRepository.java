package com.fitness.aiService.Repository;

import com.fitness.aiService.Model.Recommendations;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RecommendationRepository extends MongoRepository<Recommendations, String> {
    List<Recommendations> findByUserId(String userId);
    Optional<Recommendations> findByActivityId(String activityId);
}
