package com.example.websitedating.controllers;

import com.example.websitedating.models.Appointment;
import com.example.websitedating.services.AppointmentService;
import com.example.websitedating.dto.CreateAppointmentRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/appointments")
@CrossOrigin(origins = "*")
public class AppointmentController {
    private final AppointmentService service;

    public AppointmentController(AppointmentService service) {
        this.service = service;
    }

    @PostMapping
    public ResponseEntity<Appointment> create(@RequestBody CreateAppointmentRequest req) {
        Appointment appointment = new Appointment();
        appointment.setTitle(req.getTitle() != null ? req.getTitle() : "Date Appointment");
        appointment.setParticipantId(req.getParticipantId());
        appointment.setScheduledTime(req.getScheduledTime());
        if (req.getLocation() != null) {
            Appointment.Place place = new Appointment.Place();
            place.setPlaceName(req.getLocation());
            place.setAddress(req.getLocation());
            appointment.setLocation(place);
        }
        if (req.getEstimatedCost() != null) {
            Appointment.EstimatedCost ec = new Appointment.EstimatedCost();
            ec.setMin(req.getEstimatedCost().intValue());
            ec.setMax(req.getEstimatedCost().intValue());
            appointment.setEstimatedCost(ec);
        }
        Appointment saved = service.create(appointment);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @GetMapping
    public List<Appointment> list() {
        return service.listAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Appointment> get(@PathVariable String id) {
        return service.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{id}")
    public ResponseEntity<Appointment> update(@PathVariable String id, @RequestBody Appointment appointment) {
        Appointment updated = service.update(id, appointment);
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
