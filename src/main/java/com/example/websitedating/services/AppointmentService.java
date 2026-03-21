package com.example.websitedating.services;

import com.example.websitedating.models.Appointment;
import com.example.websitedating.repositories.AppointmentRepository;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Service;

@Service
public class AppointmentService {
    private final AppointmentRepository repo;

    public AppointmentService(AppointmentRepository repo) {
        this.repo = repo;
    }

    public Appointment create(Appointment appt) {
        return repo.save(appt);
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
