package com.example.websitedating.dto;

import lombok.Data;

@Data
public class BlockRequest {
    private String blockerClerkId;
    private String blockedUserId;
    private String reason;
}
