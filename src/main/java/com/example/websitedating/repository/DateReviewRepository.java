package com.example.websitedating.repository;

import com.example.websitedating.models.DateReview;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface DateReviewRepository extends MongoRepository<DateReview, String> {
    List<DateReview> findByVerdictIn(List<String> verdicts);
    Optional<DateReview> findByAppointmentIdAndReviewerUserId(String appointmentId, String reviewerUserId);
    List<DateReview> findByAppointmentId(String appointmentId);
    List<DateReview> findByReviewedUserId(String reviewedUserId);
    List<DateReview> findByReviewerUserId(String reviewerUserId);
}
