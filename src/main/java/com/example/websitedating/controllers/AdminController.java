package com.example.websitedating.controllers;

import com.example.websitedating.constants.CommonEnums.ReportStatus;
import com.example.websitedating.dto.AdminReportResponse;
import com.example.websitedating.dto.AdminUserResponse;
import com.example.websitedating.dto.BanRequest;
import com.example.websitedating.repository.UserRepository;
import com.example.websitedating.services.ClerkService;
import com.example.websitedating.services.ModerationService;
import java.util.Locale;
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
    private final ModerationService moderationService;

    public AdminController(UserRepository userRepository, ClerkService clerkService,
                           ModerationService moderationService) {
        this.userRepository = userRepository;
        this.clerkService = clerkService;
        this.moderationService = moderationService;
    }

    // ─── USER MANAGEMENT ──────────────────────────────────────────────────────

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

        String normalizedRole = normalizeRole(newRole);
        if (!List.of("USER", "ADMIN", "MANAGER").contains(normalizedRole)) {
            return ResponseEntity.badRequest().build();
        }

        return userRepository.findById(id).map(user -> {
            user.setRole(normalizedRole);
            userRepository.save(user);
            return ResponseEntity.ok(AdminUserResponse.from(user));
        }).orElse(ResponseEntity.notFound().build());
    }

    private String normalizeRole(String role) {
        String upperRole = role.trim().toUpperCase(Locale.ROOT);
        return upperRole.startsWith("ROLE_") ? upperRole.substring(5) : upperRole;
    }

    // ─── BAN MANAGEMENT ───────────────────────────────────────────────────────

    @PostMapping("/users/{id}/ban")
    public ResponseEntity<AdminUserResponse> banUser(
            @PathVariable String id,
            @RequestBody BanRequest request) {
        var user = moderationService.banUser(id, request.getReason(), request.getBanDurationHours());
        return ResponseEntity.ok(AdminUserResponse.from(user));
    }

    @DeleteMapping("/users/{id}/ban")
    public ResponseEntity<AdminUserResponse> unbanUser(@PathVariable String id) {
        var user = moderationService.unbanUser(id);
        return ResponseEntity.ok(AdminUserResponse.from(user));
    }

    // ─── REPORT MANAGEMENT ────────────────────────────────────────────────────

    @GetMapping("/reports")
    public ResponseEntity<List<AdminReportResponse>> getReports(
            @RequestParam(required = false) ReportStatus status) {
        return ResponseEntity.ok(moderationService.getAllReports(status));
    }

    @PatchMapping("/reports/{id}/resolve")
    public ResponseEntity<AdminReportResponse> resolveReport(
            @PathVariable String id,
            @RequestBody Map<String, String> body) {
        String statusStr = body.get("status");
        if (statusStr == null) return ResponseEntity.badRequest().build();
        ReportStatus newStatus = ReportStatus.valueOf(statusStr);
        return ResponseEntity.ok(moderationService.resolveReport(id, newStatus));
    }
}
