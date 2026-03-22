package com.example.websitedating.dto;

import java.time.Instant;

public class PremiumStatusResponse {
    private boolean active;
    private String plan;
    private Instant expiresAt;

    public PremiumStatusResponse(boolean active, String plan, Instant expiresAt) {
        this.active = active;
        this.plan = plan;
        this.expiresAt = expiresAt;
    }

    public boolean isActive() {
        return active;
    }

    public String getPlan() {
        return plan;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }
}

