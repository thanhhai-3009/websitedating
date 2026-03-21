package com.example.websitedating.services;

import com.example.websitedating.models.Appointment;
import com.example.websitedating.repository.AppointmentRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class AppointmentService {
    private final AppointmentRepository repository;

    public AppointmentService(AppointmentRepository repository) {
        this.repository = repository;
    }

    public Appointment create(Appointment appointment) {
        return repository.save(appointment);
    }

    public List<Appointment> listAll() {
        return repository.findAll();
    }

    public Optional<Appointment> findById(String id) {
        return repository.findById(id);
    }

    public Appointment update(String id, Appointment appointment) {
        appointment.setId(id);
        return repository.save(appointment);
    }

    public void delete(String id) {
        repository.deleteById(id);
    }
}
