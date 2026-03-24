package com.example.websitedating.controllers;

import com.example.websitedating.dto.DateReviewRequest;
import com.example.websitedating.models.DateReview;
import com.example.websitedating.services.DateReviewService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/reviews")
@RequiredArgsConstructor
public class DateReviewController {

    private final DateReviewService dateReviewService;

    @PostMapping
    public ResponseEntity<DateReview> createReview(@RequestBody DateReviewRequest request) {
        if (request.getReviewerUserId() == null || request.getReviewerUserId().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        
        DateReview review = dateReviewService.createReview(request, request.getReviewerUserId());
        return ResponseEntity.status(HttpStatus.CREATED).body(review);
    }
}
