package com.example.websitedating.controllers;

import com.example.websitedating.dto.BlockRequest;
import com.example.websitedating.dto.ReportRequest;
import com.example.websitedating.dto.ViolationCaseResponse;
import com.example.websitedating.services.ModerationService;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
public class ModerationController {

    private final ModerationService moderationService;

    public ModerationController(ModerationService moderationService) {
        this.moderationService = moderationService;
    }

    // ─── User endpoints ───────────────────────────────────────────────────────

    @PostMapping("/api/moderation/report")
    public ResponseEntity<Void> reportUser(@RequestBody ReportRequest req) {
        moderationService.reportUser(req);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/api/moderation/block")
    public ResponseEntity<Void> blockUser(@RequestBody BlockRequest req) {
        moderationService.blockUser(req);
        return ResponseEntity.ok().build();
    }

    // ─── Admin endpoints ──────────────────────────────────────────────────────

    @GetMapping("/api/admin/violations")
    public ResponseEntity<List<ViolationCaseResponse>> getPendingViolations() {
        return ResponseEntity.ok(moderationService.getPendingViolations());
    }

    @PostMapping("/api/admin/violations/{userId}/confirm-ban")
    public ResponseEntity<ViolationCaseResponse> confirmBan(@PathVariable String userId) {
        return ResponseEntity.ok(moderationService.confirmBan(userId));
    }

    @PostMapping("/api/admin/violations/{userId}/restore")
    public ResponseEntity<ViolationCaseResponse> restoreAccount(@PathVariable String userId) {
        return ResponseEntity.ok(moderationService.restoreAccount(userId));
    }
}
