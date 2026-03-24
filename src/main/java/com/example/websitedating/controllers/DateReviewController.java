package com.example.websitedating.controllers;

import com.example.websitedating.dto.DateReviewRequest;
import com.example.websitedating.models.DateReview;
import com.example.websitedating.models.User;
import com.example.websitedating.repository.UserRepository;
import com.example.websitedating.services.DateReviewService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/reviews")
@RequiredArgsConstructor
public class DateReviewController {

    private final DateReviewService dateReviewService;
    private final UserRepository userRepository;

    /**
     * Gửi đánh giá sau cuộc hẹn.
     * reviewerUserId được lấy từ JWT (không tin body) để đảm bảo bảo mật.
     */
    @PostMapping
    public ResponseEntity<?> createReview(@RequestBody DateReviewRequest request,
                                          Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Yêu cầu đăng nhập để gửi đánh giá"));
        }

        // principal name là clerkId hoặc email tuỳ cách auth (xem JwtAuthenticationFilter)
        String principal = authentication.getName();

        // Resolve sang internal userId (MongoDB _id)
        String reviewerUserId = resolveUserId(principal);
        if (reviewerUserId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Không tìm thấy tài khoản"));
        }

        try {
            DateReview review = dateReviewService.createReview(request, reviewerUserId);
            return ResponseEntity.status(HttpStatus.CREATED).body(review);
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Kiểm tra xem user hiện tại đã đánh giá cuộc hẹn này chưa (double-blind safe).
     * GET /api/reviews/check?appointmentId=xxx
     */
    @GetMapping("/check")
    public ResponseEntity<?> checkReviewed(@RequestParam String appointmentId,
                                           Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Yêu cầu đăng nhập"));
        }

        String principal = authentication.getName();
        String reviewerUserId = resolveUserId(principal);
        if (reviewerUserId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Không tìm thấy tài khoản"));
        }

        boolean reviewed = dateReviewService.hasReviewed(appointmentId, reviewerUserId);
        return ResponseEntity.ok(Map.of("hasReviewed", reviewed));
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    /**
     * Chuyển đổi principal (clerkId hoặc email) sang MongoDB _id của User.
     */
    private String resolveUserId(String principal) {
        // Thử tìm theo clerkId trước
        Optional<User> userOpt = userRepository.findByClerkId(principal);
        // Nếu không có, thử theo email
        if (userOpt.isEmpty()) {
            userOpt = userRepository.findByEmailIgnoreCase(principal);
        }
        return userOpt.map(User::getId).orElse(null);
    }
}
