package com.example.websitedating.models;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

@Document("date_reviews")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@CompoundIndex(name = "appointment_reviewer_unique", def = "{'appointmentId':1,'reviewerUserId':1}", unique = true)
public class DateReview {
    @Id
    private String id;
    private String appointmentId;
    private String reviewerUserId;
    private String reviewedUserId;
    private Integer rating;
    private String comment;
    @Builder.Default
    private List<String> tags = new ArrayList<>();
    private Boolean wouldMeetAgain;
    @Builder.Default
    private Instant createdAt = Instant.now();
    @Builder.Default
    private Instant updatedAt = Instant.now();
}

