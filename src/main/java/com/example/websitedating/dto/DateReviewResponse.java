package com.example.websitedating.dto;

import com.example.websitedating.models.DateReview;
import java.time.Instant;
import java.util.List;

public class DateReviewResponse {
    private String id;
    private String appointmentId;
    private String reviewerUserId;
    private String reviewedUserId;
    private Integer rating;
    private String comment;
    private List<String> tags;
    private Boolean wouldMeetAgain;
    private Instant createdAt;
    private Instant updatedAt;

    public static DateReviewResponse from(DateReview value) {
        DateReviewResponse response = new DateReviewResponse();
        response.id = value.getId();
        response.appointmentId = value.getAppointmentId();
        response.reviewerUserId = value.getReviewerUserId();
        response.reviewedUserId = value.getReviewedUserId();
        response.rating = value.getRating();
        response.comment = value.getComment();
        response.tags = value.getTags();
        response.wouldMeetAgain = value.getWouldMeetAgain();
        response.createdAt = value.getCreatedAt();
        response.updatedAt = value.getUpdatedAt();
        return response;
    }

    public String getId() {
        return id;
    }

    public String getAppointmentId() {
        return appointmentId;
    }

    public String getReviewerUserId() {
        return reviewerUserId;
    }

    public String getReviewedUserId() {
        return reviewedUserId;
    }

    public Integer getRating() {
        return rating;
    }

    public String getComment() {
        return comment;
    }

    public List<String> getTags() {
        return tags;
    }

    public Boolean getWouldMeetAgain() {
        return wouldMeetAgain;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}

