package com.example.websitedating.services;

import com.example.websitedating.constants.CommonEnums.AppointmentStatus;
import com.example.websitedating.constants.CommonEnums.NotificationType;
import com.example.websitedating.models.Appointment;
import com.example.websitedating.models.Notification;
import com.example.websitedating.repository.AppointmentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;

@Component
@RequiredArgsConstructor
public class AppointmentLifecycleScheduler {

    private final AppointmentRepository appointmentRepository;
    private final NotificationService notificationService;

    // Run every 10 minutes by default, configurable via property
    @Scheduled(fixedDelayString = "${app.appointments.markIncompleteMs:600000}")
    public void markExpiredProposedAppointments() {
        Instant now = Instant.now();
        List<Appointment> expired = appointmentRepository.findByStatusAndScheduledTimeBefore(AppointmentStatus.proposed, now);
        for (Appointment a : expired) {
            try {
                a.setStatus(AppointmentStatus.incomplete);
                appointmentRepository.save(a);

                // Notify creator that invite expired
                if (a.getCreatorId() != null) {
                    Notification note = Notification.builder()
                            .userId(a.getCreatorId())
                            .type(NotificationType.appointment_updated)
                            .content("Your appointment invitation was not accepted and is now marked incomplete.")
                            .data(java.util.Map.of("appointmentId", a.getId()))
                            .build();
                    notificationService.saveAndPush(note);
                }
            } catch (Exception e) {
                // log and continue
                e.printStackTrace();
            }
        }
    }
}
