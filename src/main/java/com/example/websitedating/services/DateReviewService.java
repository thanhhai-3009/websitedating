package com.example.websitedating.services;

import com.example.websitedating.constants.CommonEnums.AppointmentStatus;
import com.example.websitedating.dto.DateReviewUpsertRequest;
import com.example.websitedating.models.Appointment;
import com.example.websitedating.models.DateReview;
import com.example.websitedating.models.User;
import com.example.websitedating.repository.AppointmentRepository;
import com.example.websitedating.repository.DateReviewRepository;
import com.example.websitedating.repository.UserRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class DateReviewService {

    private final DateReviewRepository dateReviewRepository;
    private final AppointmentRepository appointmentRepository;
    private final UserRepository userRepository;

    public DateReviewService(
            DateReviewRepository dateReviewRepository,
            AppointmentRepository appointmentRepository,
            UserRepository userRepository) {
        this.dateReviewRepository = dateReviewRepository;
        this.appointmentRepository = appointmentRepository;
        this.userRepository = userRepository;
    }

    public DateReview upsertMyReview(String authPrincipal, String appointmentId, DateReviewUpsertRequest request) {
        String reviewerUserId = resolveCurrentUserId(authPrincipal);
        Appointment appointment = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Appointment not found"));

        if (appointment.getStatus() != AppointmentStatus.completed) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only completed appointments can be reviewed");
        }

        boolean isCreator = matchesReviewer(appointment.getCreatorId(), reviewerUserId, authPrincipal);
        boolean isParticipant = matchesReviewer(appointment.getParticipantId(), reviewerUserId, authPrincipal);
        if (!isCreator && !isParticipant) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You cannot review this appointment");
        }

        String reviewedUserRawId = isCreator ? appointment.getParticipantId() : appointment.getCreatorId();
        String reviewedUserId = resolveMongoUserId(reviewedUserRawId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Reviewed user cannot be resolved"));
        Instant now = Instant.now();

        DateReview review = dateReviewRepository
                .findByAppointmentIdAndReviewerUserId(appointmentId, reviewerUserId)
                .orElseGet(DateReview::new);

        if (review.getId() == null) {
            review.setAppointmentId(appointmentId);
            review.setReviewerUserId(reviewerUserId);
            review.setReviewedUserId(reviewedUserId);
            review.setCreatedAt(now);
        }

        review.setRating(request.getRating());
        review.setComment(request.getComment());
        review.setTags(request.getTags() == null ? new ArrayList<>() : request.getTags());
        review.setWouldMeetAgain(request.getWouldMeetAgain());
        review.setUpdatedAt(now);

        return dateReviewRepository.save(review);
    }

    public Optional<DateReview> getMyReview(String authPrincipal, String appointmentId) {
        String reviewerUserId = resolveCurrentUserId(authPrincipal);
        return dateReviewRepository.findByAppointmentIdAndReviewerUserId(appointmentId, reviewerUserId);
    }

    public List<DateReview> getMyReviewsByAppointments(String authPrincipal, List<String> appointmentIds) {
        if (appointmentIds == null || appointmentIds.isEmpty()) {
            return List.of();
        }
        String reviewerUserId = resolveCurrentUserId(authPrincipal);
        return dateReviewRepository.findByAppointmentIdInAndReviewerUserId(appointmentIds, reviewerUserId);
    }

    private String resolveCurrentUserId(String authPrincipal) {
        if (authPrincipal == null || authPrincipal.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing authentication principal");
        }

        Optional<User> byClerkId = userRepository.findByClerkId(authPrincipal);
        if (byClerkId.isPresent()) {
            return byClerkId.get().getId();
        }

        Optional<User> byEmail = userRepository.findByEmailIgnoreCase(authPrincipal);
        if (byEmail.isPresent()) {
            return byEmail.get().getId();
        }

        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authenticated user not found");
    }

    private boolean matchesReviewer(String appointmentPartyId, String reviewerUserId, String authPrincipal) {
        if (appointmentPartyId == null || appointmentPartyId.isBlank()) {
            return false;
        }
        return appointmentPartyId.equals(reviewerUserId)
                || (authPrincipal != null && appointmentPartyId.equals(authPrincipal));
    }

    private Optional<String> resolveMongoUserId(String value) {
        if (value == null || value.isBlank()) {
            return Optional.empty();
        }

        Optional<User> byId = userRepository.findById(value);
        if (byId.isPresent()) {
            return Optional.of(byId.get().getId());
        }

        Optional<User> byClerkId = userRepository.findByClerkId(value);
        if (byClerkId.isPresent()) {
            return Optional.of(byClerkId.get().getId());
        }

        return Optional.empty();
    }
}
