package com.fitness.activityService.Service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

@Service
@Slf4j
@RequiredArgsConstructor
public class userValidationService {
    private final WebClient userServiceWebClient;

    public boolean validateUser(String userId) {
        log.info("Calling User validation api for userId: {}", userId);
        try {
            return userServiceWebClient.get()
                    .uri("/api/users/{userId}/validate", userId)
                    .retrieve()             // makes the api call
                    .bodyToMono(Boolean.class)
                    .block();
        }
        catch (WebClientResponseException e) {
            if (e.getStatusCode() == HttpStatus.NOT_FOUND)
                throw new RuntimeException("User Not Found: " + userId);
            else if (e.getStatusCode() == HttpStatus.BAD_REQUEST)
                throw new RuntimeException("Invalid Request " + userId);
        }
        return false;
    }
}
