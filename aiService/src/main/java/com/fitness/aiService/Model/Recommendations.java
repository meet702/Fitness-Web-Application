package com.fitness.aiService.Model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.List;

@Document(collection = "aiRecommendations")
@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class Recommendations {

    @Id
    private String Id;
    private String activityId;
    private String userId;
    private String activityType;
    private String recommendation;
    private List<String> suggestions;
    private List<String> improvements;
    private List<String> safety;

    @CreatedDate
    private LocalDateTime createdAt;
}
