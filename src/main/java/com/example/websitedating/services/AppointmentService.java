package com.example.websitedating.services;

import com.example.websitedating.models.Appointment;
import com.example.websitedating.models.Notification;
import com.example.websitedating.constants.CommonEnums.NotificationType;
import com.example.websitedating.repository.NotificationRepository;
import com.example.websitedating.repository.AppointmentRepository;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Service;

@Service
public class AppointmentService {
    private final AppointmentRepository repo;
    private final NotificationRepository notificationRepository;

    public AppointmentService(AppointmentRepository repo, NotificationRepository notificationRepository) {
        this.repo = repo;
        this.notificationRepository = notificationRepository;
    }

    public Appointment create(Appointment appt) {
        Appointment saved = repo.save(appt);

        // create an in-app notification for the participant
        try {
            if (saved.getParticipantId() != null && !saved.getParticipantId().isBlank()) {
                Notification note = Notification.builder()
                        .userId(saved.getParticipantId())
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
