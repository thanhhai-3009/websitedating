package com.example.websitedating.controllers;

import com.example.websitedating.dto.UserResponse;
import com.example.websitedating.dto.OnboardingRequest;
import com.example.websitedating.services.UserOnboardingService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserOnboardingService userOnboardingService;

    public UserController(UserOnboardingService userOnboardingService) {
        this.userOnboardingService = userOnboardingService;
    }

    @PostMapping("/onboarding")
    @ResponseStatus(HttpStatus.OK)
    public UserResponse onboarding(@Valid @RequestBody OnboardingRequest request) {
        return userOnboardingService.save(request);
    }
}
