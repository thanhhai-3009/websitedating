package com.example.websitedating.repository;

import com.example.websitedating.models.DateReview;
import java.util.List;
import java.util.Optional;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface DateReviewRepository extends MongoRepository<DateReview, String> {
    Optional<DateReview> findByAppointmentIdAndReviewerUserId(String appointmentId, String reviewerUserId);
    List<DateReview> findByAppointmentIdInAndReviewerUserId(List<String> appointmentIds, String reviewerUserId);
}

