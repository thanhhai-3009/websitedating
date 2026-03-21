package com.example.websitedating.dto;

import jakarta.validation.constraints.NotBlank;

public class AcceptConnectionRequest {

    @NotBlank(message = "Clerk ID is required")
    private String clerkId;

    @NotBlank(message = "Target user ID is required")
    private String targetUserId;

    public String getClerkId() {
        return clerkId;
    }

    public void setClerkId(String clerkId) {
        this.clerkId = clerkId;
    }

    public String getTargetUserId() {
        return targetUserId;
    }

    public void setTargetUserId(String targetUserId) {
        this.targetUserId = targetUserId;
    }
}

