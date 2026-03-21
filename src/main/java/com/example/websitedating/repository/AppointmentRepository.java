package com.example.websitedating.repository;

import com.example.websitedating.models.Appointment;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;

public interface AppointmentRepository extends MongoRepository<Appointment, String> {
    List<Appointment> findByCreatorId(String creatorId);
}
