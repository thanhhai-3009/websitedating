package com.example.websitedating.repositories;

import com.example.websitedating.models.Appointment;
import java.util.List;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AppointmentRepository extends MongoRepository<Appointment, String> {
    List<Appointment> findByCreatorIdOrParticipantId(String creatorId, String participantId);
}
