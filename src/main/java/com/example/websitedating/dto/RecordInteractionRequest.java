package com.example.websitedating.dto;

import com.example.websitedating.constants.CommonEnums.InteractionType;
import com.example.websitedating.constants.CommonEnums.RecentActionType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class RecordInteractionRequest {

    @NotBlank(message = "Clerk ID is required")
    private String clerkId;

    @NotBlank(message = "Target user ID is required")
    private String targetUserId;

    @NotNull(message = "Action type is required")
    private RecentActionType actionType;

    private InteractionType interactionType;

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

    public RecentActionType getActionType() {
        return actionType;
    }

    public void setActionType(RecentActionType actionType) {
        this.actionType = actionType;
    }

    public InteractionType getInteractionType() {
        return interactionType;
    }

    public void setInteractionType(InteractionType interactionType) {
        this.interactionType = interactionType;
    }
}

