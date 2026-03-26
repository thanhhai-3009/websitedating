package com.example.websitedating.repository;

import com.example.websitedating.models.Appointment;
import java.util.List;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import com.example.websitedating.constants.CommonEnums.AppointmentStatus;
import java.time.Instant;

@Repository
public interface AppointmentRepository extends MongoRepository<Appointment, String> {
    List<Appointment> findByCreatorIdOrParticipantId(String creatorId, String participantId);

    List<Appointment> findByStatusAndScheduledTimeBefore(AppointmentStatus status, Instant time);
}
