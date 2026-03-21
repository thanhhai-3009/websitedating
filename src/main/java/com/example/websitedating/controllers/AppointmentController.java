package com.example.websitedating.controllers;

import com.example.websitedating.models.Appointment;
import com.example.websitedating.services.AppointmentService;
import java.util.List;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/appointments")
public class AppointmentController {
    private final AppointmentService service;

    public AppointmentController(AppointmentService service) {
        this.service = service;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Appointment create(@RequestBody Appointment appointment) {
        return service.create(appointment);
    }

    @GetMapping("/{id}")
    public Appointment get(@PathVariable String id) {
        Optional<Appointment> ap = service.findById(id);
        return ap.orElseThrow(() -> new RuntimeException("Appointment not found"));
    }

    @GetMapping
    public List<Appointment> list(@RequestParam(required = false) String userId) {
        if (userId == null) return service.findAll();
        return service.findForUser(userId);
    }

    @PutMapping("/{id}")
    public Appointment update(@PathVariable String id, @RequestBody Appointment appointment) {
        return service.update(id, appointment);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String id) {
        service.delete(id);
    }
}
