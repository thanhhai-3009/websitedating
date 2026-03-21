package com.example.websitedating.models;

import com.example.websitedating.constants.CommonEnums.RecentActionType;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.geo.Point;
import org.springframework.data.mongodb.core.index.*;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

@Document("users")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@CompoundIndexes({
        @CompoundIndex(name = "age_gender_region_idx", def = "{'profile.personalInfo.age':1,'profile.personalInfo.gender':1,'profile.personalInfo.region':1}"),
        @CompoundIndex(name = "interests_idx", def = "{'profile.interests':1}")
})
public class User {
    @Id
    private String id;

    @Indexed(unique = true, sparse = true)
    private String clerkId;

    @Indexed(unique = true)
    private String email;

    @Indexed(unique = true, sparse = true)
    private String phone;

    private String passwordHash;

    @Indexed(unique = true)
    private String username;

    @Builder.Default
    private Boolean isVerified = false;

    private Profile profile;
    private Preferences preferences;
    private BehaviorSignals behaviorSignals;
    private Settings settings;
    private Status status;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Profile {
        @Builder.Default
        private String avatarUrl = "";
        @Builder.Default
        private String bio = "";
        @Builder.Default
        private List<String> photos = List.of();
        private PersonalInfo personalInfo;
        private List<String> interests;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PersonalInfo {
        private String name;
        private LocalDate birthday;
        private Integer age;
        private String gender;
        private String locationText;

        @GeoSpatialIndexed(type = GeoSpatialIndexType.GEO_2DSPHERE)
        private Point location; // longitude, latitude

        private String region;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Preferences {
        private IntRange ageRange;
        private List<String> preferredGenders;
        private List<String> preferredRegions;
        @Builder.Default
        private Integer maxDistanceKm = 30;
        private List<String> preferredInterests;
        private String relationshipGoal;
        private IntRange budgetRange;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class IntRange {
        @Builder.Default
        private Integer min = 0;
        @Builder.Default
        private Integer max = 0;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class BehaviorSignals {
        @Builder.Default
        private Integer likesGiven = 0;
        @Builder.Default
        private Integer likesReceived = 0;
        @Builder.Default
        private Integer profileViews = 0;
        private List<Integer> activeHours;
        private List<RecentAction> recentActions;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RecentAction {
        private RecentActionType actionType;
        private String targetUserId;
        @Builder.Default
        private Instant createdAt = Instant.now();
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Settings {
        @Builder.Default
        private Boolean notificationPref = true;
        @Builder.Default
        private Boolean privacyPref = true;
        @Builder.Default
        private Boolean allowVideoCall = true;
        @Builder.Default
        private Boolean allowGeoDiscovery = true;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Status {
        @Builder.Default
        private Boolean online = false;
        @Builder.Default
        private Instant lastSeen = Instant.now();
    }
}


