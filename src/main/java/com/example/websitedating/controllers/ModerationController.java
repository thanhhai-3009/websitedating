package com.example.websitedating.controllers;

import com.example.websitedating.dto.BlockRequest;
import com.example.websitedating.dto.ReportRequest;
import com.example.websitedating.models.User;
import com.example.websitedating.services.ModerationService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/moderation")
public class ModerationController {

    private final ModerationService moderationService;

    public ModerationController(ModerationService moderationService) {
        this.moderationService = moderationService;
    }

    // ─── BLOCK ────────────────────────────────────────────────────────────────

    @PostMapping("/block")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void blockUser(@Valid @RequestBody BlockRequest request) {
        moderationService.blockUser(request.getClerkId(), request.getTargetUserId(), request.getReason());
    }

    @DeleteMapping("/block")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unblockUser(
            @RequestParam String clerkId,
            @RequestParam String targetUserId) {
        moderationService.unblockUser(clerkId, targetUserId);
    }

    @GetMapping("/blocked-users")
    public ResponseEntity<List<Map<String, Object>>> getBlockedUsers(@RequestParam String clerkId) {
        List<User> blockedUsers = moderationService.getBlockedUsers(clerkId);
        List<Map<String, Object>> result = blockedUsers.stream()
                .map(u -> Map.<String, Object>of(
                        "id", u.getId(),
                        "username", u.getUsername() != null ? u.getUsername() : "",
                        "avatarUrl", u.getProfile() != null && u.getProfile().getAvatarUrl() != null
                                ? u.getProfile().getAvatarUrl() : ""
                ))
                .toList();
        return ResponseEntity.ok(result);
    }

    @GetMapping("/is-blocked")
    public ResponseEntity<Map<String, Boolean>> isBlocked(
            @RequestParam String clerkId,
            @RequestParam String targetUserId) {
        boolean blocked = moderationService.isBlocked(clerkId, targetUserId);
        return ResponseEntity.ok(Map.of("blocked", blocked));
    }

    // ─── REPORT ───────────────────────────────────────────────────────────────

    @PostMapping("/report")
    @ResponseStatus(HttpStatus.CREATED)
    public void reportUser(@Valid @RequestBody ReportRequest request) {
        moderationService.reportUser(
                request.getClerkId(),
                request.getReportedUserId(),
                request.getReasonCategory(),
                request.getReason(),
                request.getEvidenceUrls()
        );
    }
}
