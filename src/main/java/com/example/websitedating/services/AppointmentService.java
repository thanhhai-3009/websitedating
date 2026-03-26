package com.example.websitedating.services;

import com.example.websitedating.models.Appointment;
import com.example.websitedating.models.Notification;
import com.example.websitedating.constants.CommonEnums.NotificationType;
import com.example.websitedating.repository.AppointmentRepository;
import com.example.websitedating.repository.UserRepository;
import com.example.websitedating.models.User;
import java.util.List;
import com.example.websitedating.constants.CommonEnums.AppointmentStatus;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Service;

@Service
public class AppointmentService {
    private final AppointmentRepository repo;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final AppointmentEmailService appointmentEmailService;

    public AppointmentService(
            AppointmentRepository repo,
            UserRepository userRepository,
            NotificationService notificationService,
            AppointmentEmailService appointmentEmailService
    ) {
        this.repo = repo;
        this.userRepository = userRepository;
        this.notificationService = notificationService;
        this.appointmentEmailService = appointmentEmailService;
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
                // persist and push realtime
                notificationService.saveAndPush(note);

                // Send detailed appointment email via SMTP to participant.
                Optional<User> participantUser = resolveUser(saved.getParticipantId());
                Optional<User> creatorUser = resolveUser(saved.getCreatorId());
                participantUser.ifPresent(user -> appointmentEmailService.sendCreatedAppointmentEmail(user, creatorUser.orElse(null), saved));

                // Also send to creator so both sides receive full booking details.
                creatorUser.ifPresent(user -> appointmentEmailService.sendCreatedAppointmentEmail(user, participantUser.orElse(null), saved));
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
        // Instead of deleting the appointment record, mark it as canceled so it shows up
        // in the other user's Past list and keep audit/history.
        try {
            var opt = repo.findById(id);
            if (opt.isPresent()) {
                Appointment appt = opt.get();
                appt.setStatus(AppointmentStatus.canceled);
                repo.save(appt);

                // Notify both parties if present
                String creator = appt.getCreatorId();
                String participant = appt.getParticipantId();
                java.util.Set<String> notifyTargets = new java.util.HashSet<>();
                if (creator != null && !creator.isBlank()) notifyTargets.add(creator);
                if (participant != null && !participant.isBlank()) notifyTargets.add(participant);

                for (String target : notifyTargets) {
                    String notifUserId = target;
                    try {
                        var byClerk = userRepository.findByClerkId(target);
                        if (byClerk.isPresent()) notifUserId = byClerk.get().getId();
                        else {
                            var byId = userRepository.findById(target);
                            if (byId.isPresent()) notifUserId = byId.get().getId();
                        }
                    } catch (Exception e) {
                        // ignore resolution failure
                    }

                    Notification note = Notification.builder()
                        .userId(notifUserId)
                        .type(NotificationType.appointment_updated)
                        .content("An appointment was cancelled.")
                        .data(Map.of("appointmentId", id))
                        .build();
                    try {
                        notificationService.saveAndPush(note);
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                }
                return;
            }
        } catch (Exception ex) {
            // fallback to delete if something unexpected happens
            ex.printStackTrace();
        }

        repo.deleteById(id);
    }

    private Optional<User> resolveUser(String userRef) {
        if (userRef == null || userRef.isBlank()) {
            return Optional.empty();
        }

        try {
            Optional<User> byClerk = userRepository.findByClerkId(userRef);
            if (byClerk.isPresent()) {
                return byClerk;
            }
        } catch (Exception ignored) {
            // continue fallback resolution
        }

        try {
            return userRepository.findById(userRef);
        } catch (Exception ignored) {
            return Optional.empty();
        }
    }
}
