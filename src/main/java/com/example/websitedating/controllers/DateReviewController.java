package com.example.websitedating.controllers;

import com.example.websitedating.dto.DateReviewResponse;
import com.example.websitedating.dto.DateReviewUpsertRequest;
import com.example.websitedating.models.DateReview;
import com.example.websitedating.services.DateReviewService;
import jakarta.validation.Valid;
import java.security.Principal;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/date-reviews")
public class DateReviewController {

    private final DateReviewService dateReviewService;

    public DateReviewController(DateReviewService dateReviewService) {
        this.dateReviewService = dateReviewService;
    }

    @GetMapping("/appointment/{appointmentId}/mine")
    public DateReviewResponse getMyByAppointment(@PathVariable String appointmentId, Principal principal) {
        String principalName = requirePrincipal(principal);
        DateReview value = dateReviewService.getMyReview(principalName, appointmentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Review not found"));
        return DateReviewResponse.from(value);
    }

    @GetMapping("/mine")
    public List<DateReviewResponse> getMyByAppointments(
            @RequestParam List<String> appointmentIds,
            Principal principal) {
        String principalName = requirePrincipal(principal);
        return dateReviewService.getMyReviewsByAppointments(principalName, appointmentIds).stream()
                .map(DateReviewResponse::from)
                .toList();
    }

    @PutMapping("/appointment/{appointmentId}")
    @ResponseStatus(HttpStatus.OK)
    public DateReviewResponse upsert(
            @PathVariable String appointmentId,
            @Valid @RequestBody DateReviewUpsertRequest request,
            Principal principal) {
        String principalName = requirePrincipal(principal);
        DateReview saved = dateReviewService.upsertMyReview(principalName, appointmentId, request);
        return DateReviewResponse.from(saved);
    }

    private String requirePrincipal(Principal principal) {
        if (principal == null || principal.getName() == null || principal.getName().isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthenticated");
        }
        return principal.getName();
    }
}
