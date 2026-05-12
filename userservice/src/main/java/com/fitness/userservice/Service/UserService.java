package com.fitness.userservice.Service;

import com.fitness.userservice.DTO.RegisterRequest;
import com.fitness.userservice.DTO.UserResponse;
import com.fitness.userservice.Model.User;
import com.fitness.userservice.Repository.UserRepository;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.Optional;

@Service
@Slf4j
public class UserService {

    @Autowired
    private UserRepository userRepository;

    public UserResponse register(@Valid RegisterRequest request) {

        // 1. If user already exists by email → update keycloak ID if needed
        if (userRepository.existsByEmail(request.getEmail())) {

            User existingUser = userRepository.findByEmail(request.getEmail());

            // If keycloakId is different → update it
            if (request.getKeyCloakId() != null
                    && (existingUser.getKeyCloakId() == null
                    || !existingUser.getKeyCloakId().equals(request.getKeyCloakId()))) {

                existingUser.setKeyCloakId(request.getKeyCloakId());
                existingUser = userRepository.save(existingUser);
            }

            return toResponse(existingUser);
        }

        // 2. Normal registration flow for new users
        User user = new User();
        user.setEmail(request.getEmail());
        user.setKeyCloakId(request.getKeyCloakId());
        user.setPassword(request.getPassword());
        user.setFirstName(request.getFirstName());
        user.setLastName(request.getLastName());
        user.setCreatedAt(OffsetDateTime.now().toLocalDateTime());
        user.setUpdatedAt(OffsetDateTime.now().toLocalDateTime());

        User savedUser = userRepository.save(user);
        return toResponse(savedUser);
    }


    public UserResponse getUserProfile(String userId) {
        // 1) try by primary id
        Optional<User> byId = userRepository.findById(userId);
        if (byId.isPresent()) {
            return toResponse(byId.get());
        }

        // 2) fallback: try by keycloak id
        Optional<User> byKc = userRepository.findByKeyCloakId(userId);
        if (byKc.isPresent()) {
            return toResponse(byKc.get());
        }

        throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User Not Found");
    }

    public Boolean existByUserId(String userId) {
        log.info("Calling User validation api for userId: {}", userId);
        if (userId == null) return false;

        // check by keycloak id first
        Boolean byKc = userRepository.existsByKeyCloakId(userId);
        if (Boolean.TRUE.equals(byKc)) return true;

        // fallback to DB id exists
        return userRepository.existsById(userId);
    }

    private UserResponse toResponse(User user) {
        UserResponse res = new UserResponse();
        res.setId(user.getId());
        res.setKeyCloakId(user.getKeyCloakId());
        res.setEmail(user.getEmail());
        res.setPassword(user.getPassword());
        res.setFirstName(user.getFirstName());
        res.setLastName(user.getLastName());
        res.setCreatedAt(user.getCreatedAt());
        res.setUpdatedAt(user.getUpdatedAt());
        return res;
    }

}
