package com.example.websitedating.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class BlockRequest {
    @NotBlank
    private String clerkId;
    @NotBlank
    private String targetUserId;
    private String reason;
}
