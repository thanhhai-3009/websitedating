package com.example.websitedating.controllers;

import com.example.websitedating.models.User;
import com.example.websitedating.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final UserRepository userRepository;

    @GetMapping("/violators")
    public ResponseEntity<List<User>> getViolators() {
        List<User> violators = userRepository.findViolators(Instant.now());
        // Có thể filter hoặc map sang DTO nếu cần thiết để giấu bớt thông tin nhạy cảm
        return ResponseEntity.ok(violators);
    }
}
