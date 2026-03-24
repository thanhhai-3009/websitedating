package com.example.websitedating.models;

import com.example.websitedating.constants.CommonEnums.*;
import lombok.*;
import org.springframework.data.annotation.*;
import org.springframework.data.geo.Point;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;
import java.util.List;

@Document("appointments")
@Data @Builder @NoArgsConstructor @AllArgsConstructor
@CompoundIndexes({
        @CompoundIndex(name = "creator_participant_time_idx", def = "{'creatorId':1,'participantId':1,'scheduledTime':1}"),
        @CompoundIndex(name = "scheduled_status_idx", def = "{'scheduledTime':1,'status':1}")
})
public class Appointment {
    @Id private String id;
    private String creatorId;
    private String participantId;
    @Builder.Default private String title = "Date Appointment";
    private Place location;
    private List<TimeSlot> suggestedTimeSlots;
    private Instant scheduledTime;
    private EstimatedCost estimatedCost;
    @Builder.Default private AppointmentStatus status = AppointmentStatus.scheduled;
    @Builder.Default private SuggestionSource suggestionSource = SuggestionSource.manual;
    private List<Feedback> feedbacks;
    private String updatedBy;
    @Builder.Default private Boolean creatorContinued = false;
    @Builder.Default private Boolean participantContinued = false;

    @CreatedDate private Instant createdAt;
    @LastModifiedDate private Instant updatedAt;

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Place {
        private String placeName;
        private String address;
        private Point geo;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class TimeSlot {
        private Instant startTime;
        private Instant endTime;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class EstimatedCost {
        @Builder.Default private Integer min = 0;
        @Builder.Default private Integer max = 0;
        @Builder.Default private String currency = "VND";
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Feedback {
        private String userId;
        private Integer rating; // 1..5
        private String comment;
        @Builder.Default private Instant createdAt = Instant.now();
    }
}
