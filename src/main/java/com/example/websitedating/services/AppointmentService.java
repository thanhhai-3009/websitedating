package com.example.websitedating.services;

import com.example.websitedating.models.Appointment;
import com.example.websitedating.models.Notification;
import com.example.websitedating.constants.CommonEnums.NotificationType;
import com.example.websitedating.repository.NotificationRepository;
import com.example.websitedating.repository.AppointmentRepository;
import com.example.websitedating.repository.UserRepository;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Service;

@Service
public class AppointmentService {
    private final AppointmentRepository repo;
    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;

    public AppointmentService(AppointmentRepository repo, NotificationRepository notificationRepository, UserRepository userRepository) {
        this.repo = repo;
        this.notificationRepository = notificationRepository;
        this.userRepository = userRepository;
    }

    public Appointment create(Appointment appt) {
        Appointment saved = repo.save(appt);

        // create an in-app notification for the participant
        try {
            if (saved.getParticipantId() != null && !saved.getParticipantId().isBlank()) {
                // Resolve participantId to internal user id if caller passed a Clerk id
                String notifUserId = saved.getParticipantId();
                // try as clerkId first
                try {
                    var byClerk = userRepository.findByClerkId(saved.getParticipantId());
                    if (byClerk.isPresent()) {
                        notifUserId = byClerk.get().getId();
                    } else {
                        // if not found by clerk id, check if participantId is already internal id
                        var byId = userRepository.findById(saved.getParticipantId());
                        if (byId.isPresent()) {
                            notifUserId = byId.get().getId();
                        }
                    }
                } catch (Exception e) {
                    // fallback to provided id if resolution fails
                }

                Notification note = Notification.builder()
                        .userId(notifUserId)
                        .type(NotificationType.upcoming_appointment)
                        .content("You have a new date appointment scheduled.")
                        .data(Map.of("appointmentId", saved.getId(), "creatorId", saved.getCreatorId()))
                        .build();
                notificationRepository.save(note);
            }
        } catch (Exception ex) {
            // log but don't fail the appointment creation
            ex.printStackTrace();
        }

        return saved;
    }

    public Optional<Appointment> findById(String id) {
        return repo.findById(id);
    }

    public List<Appointment> findAll() {
        return repo.findAll();
    }

    public List<Appointment> findForUser(String userId) {
        return repo.findByCreatorIdOrParticipantId(userId, userId);
    }

    public Appointment update(String id, Appointment updated) {
        updated.setId(id);
        return repo.save(updated);
    }

    public void delete(String id) {
        repo.deleteById(id);
    }
}
