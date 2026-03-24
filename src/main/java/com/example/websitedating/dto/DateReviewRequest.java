package com.example.websitedating.dto;

import lombok.Data;
import java.util.List;

@Data
public class DateReviewRequest {
    private String appointmentId;
    private String reviewedUserId;
    private String reviewerUserId; // This will be the Clerk ID of the user submitting the review
    private boolean didMeet;
    private String whoAbsent;
    private String photoMatch;
    private List<String> behaviourTags;
    private boolean wantSimilar;
    private String verdict;
}
