package com.example.websitedating.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.example.websitedating.constants.CommonEnums.AppointmentStatus;
import com.example.websitedating.dto.DateReviewUpsertRequest;
import com.example.websitedating.models.Appointment;
import com.example.websitedating.models.DateReview;
import com.example.websitedating.models.User;
import com.example.websitedating.repository.AppointmentRepository;
import com.example.websitedating.repository.DateReviewRepository;
import com.example.websitedating.repository.UserRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class DateReviewServiceTest {

    @Mock
    private DateReviewRepository dateReviewRepository;

    @Mock
    private AppointmentRepository appointmentRepository;

    @Mock
    private UserRepository userRepository;

    private DateReviewService dateReviewService;

    @BeforeEach
    void setup() {
        dateReviewService = new DateReviewService(dateReviewRepository, appointmentRepository, userRepository);
    }

    @Test
    void upsertMyReview_createsWithCounterpartUser() {
        User me = User.builder().id("u1").clerkId("clerk_1").email("u1@test.com").username("u1").build();
        Appointment appointment = Appointment.builder()
                .id("apt1")
                .creatorId("u1")
                .participantId("u2")
                .status(AppointmentStatus.completed)
                .build();

        DateReviewUpsertRequest request = new DateReviewUpsertRequest();
        request.setRating(5);
        request.setComment("Great date");
        request.setTags(List.of("Funny"));
        request.setWouldMeetAgain(true);

        when(userRepository.findByClerkId("clerk_1")).thenReturn(Optional.of(me));
        when(appointmentRepository.findById("apt1")).thenReturn(Optional.of(appointment));
        when(dateReviewRepository.findByAppointmentIdAndReviewerUserId("apt1", "u1")).thenReturn(Optional.empty());
        when(dateReviewRepository.save(any(DateReview.class))).thenAnswer(invocation -> invocation.getArgument(0));

        DateReview saved = dateReviewService.upsertMyReview("clerk_1", "apt1", request);

        assertEquals("apt1", saved.getAppointmentId());
        assertEquals("u1", saved.getReviewerUserId());
        assertEquals("u2", saved.getReviewedUserId());
        assertEquals(5, saved.getRating());
    }

    @Test
    void upsertMyReview_rejectsNonCompletedAppointment() {
        User me = User.builder().id("u1").clerkId("clerk_1").email("u1@test.com").username("u1").build();
        Appointment appointment = Appointment.builder()
                .id("apt1")
                .creatorId("u1")
                .participantId("u2")
                .status(AppointmentStatus.scheduled)
                .build();

        DateReviewUpsertRequest request = new DateReviewUpsertRequest();
        request.setRating(4);

        when(userRepository.findByClerkId("clerk_1")).thenReturn(Optional.of(me));
        when(appointmentRepository.findById("apt1")).thenReturn(Optional.of(appointment));

        assertThrows(ResponseStatusException.class, () -> dateReviewService.upsertMyReview("clerk_1", "apt1", request));
    }
}

