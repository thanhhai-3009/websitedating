package com.example.websitedating.models;

import lombok.Data;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Document(collection = "date_reviews")
public class DateReview {

    @Id
    private String id;

    private String appointmentId;
    private String reviewedUserId;
    private String reviewerUserId;

    private boolean didMeet;
    private String whoAbsent; // "them" or "me"

    private String photoMatch; // "90-100", "50-80", "under50"
    private List<String> behaviourTags;
    private boolean wantSimilar;

    private String verdict; // "good", "medium", "negative", "dangerous"

    @CreatedDate
    private LocalDateTime createdAt;
}
