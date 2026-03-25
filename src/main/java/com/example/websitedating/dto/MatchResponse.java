package com.example.websitedating.dto;

import com.example.websitedating.constants.CommonEnums.ConnectionStatus;
import com.example.websitedating.models.User;
import java.time.Instant;

public class MatchResponse {

    private String userId;
    private String displayName;
    private Integer age;
    private String avatarUrl;
    private boolean online;
    private Instant matchedAt;
    private String roomId;
    private String clerkId;
    private String status;
    private boolean likedByMe;

    public static MatchResponse from(User user, Instant matchedAt, String roomId, ConnectionStatus status, boolean likedByMe) {
        MatchResponse response = new MatchResponse();
        response.userId = user.getId();

        User.PersonalInfo personalInfo = user.getProfile() == null ? null : user.getProfile().getPersonalInfo();
        response.displayName = personalInfo != null && personalInfo.getName() != null && !personalInfo.getName().isBlank()
                ? personalInfo.getName()
                : user.getUsername();
        response.age = personalInfo == null ? null : personalInfo.getAge();
        response.avatarUrl = user.getProfile() == null ? "" : (user.getProfile().getAvatarUrl() == null ? "" : user.getProfile().getAvatarUrl());
        response.online = user.getStatus() != null && Boolean.TRUE.equals(user.getStatus().getOnline());
        response.matchedAt = matchedAt;
        response.roomId = roomId;
        response.clerkId = user.getClerkId();
        response.status = status == null ? ConnectionStatus.matched.name() : status.name();
        response.likedByMe = likedByMe;
        return response;
    }

    public String getUserId() {
        return userId;
    }

    public String getDisplayName() {
        return displayName;
    }

    public Integer getAge() {
        return age;
    }

    public String getAvatarUrl() {
        return avatarUrl;
    }

    public boolean isOnline() {
        return online;
    }

    public void setOnline(boolean online) {
        this.online = online;
    }

    public Instant getMatchedAt() {
        return matchedAt;
    }

    public String getRoomId() {
        return roomId;
    }

    public String getClerkId() {
        return clerkId;
    }

    public String getStatus() {
        return status;
    }

    public boolean isLikedByMe() {
        return likedByMe;
    }
}
