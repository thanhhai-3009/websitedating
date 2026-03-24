package com.example.websitedating.controllers;

import com.example.websitedating.dto.AdminUserResponse;
import com.example.websitedating.repository.UserRepository;
import com.example.websitedating.services.ClerkService;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final UserRepository userRepository;
    private final ClerkService clerkService;

    public AdminController(UserRepository userRepository, ClerkService clerkService) {
        this.userRepository = userRepository;
        this.clerkService = clerkService;
    }

    @GetMapping("/users")
    public ResponseEntity<List<AdminUserResponse>> getAllUsers() {
        List<AdminUserResponse> users = userRepository.findAll().stream()
                .map(AdminUserResponse::from)
                .collect(Collectors.toList());
        return ResponseEntity.ok(users);
    }

    @DeleteMapping("/users/{id}")
    public ResponseEntity<Void> deleteUser(@PathVariable String id) {
        userRepository.findById(id).ifPresent(user -> {
            if (user.getClerkId() != null) {
                clerkService.deleteUser(user.getClerkId());
            }
            userRepository.deleteById(id);
        });
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/users/{id}/role")
    public ResponseEntity<AdminUserResponse> updateUserRole(
            @PathVariable String id,
            @RequestBody Map<String, String> body) {
        String newRole = body.get("role");
        if (newRole == null || newRole.isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        return userRepository.findById(id).map(user -> {
            user.setRole(newRole.toUpperCase());
            userRepository.save(user);
            return ResponseEntity.ok(AdminUserResponse.from(user));
        }).orElse(ResponseEntity.notFound().build());
    }
}
