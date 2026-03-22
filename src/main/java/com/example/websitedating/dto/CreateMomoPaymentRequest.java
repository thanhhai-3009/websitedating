package com.example.websitedating.dto;

import jakarta.validation.constraints.NotBlank;

public class CreateMomoPaymentRequest {

    @NotBlank(message = "Plan ID is required")
    private String planId;

    public String getPlanId() {
        return planId;
    }

    public void setPlanId(String planId) {
        this.planId = planId;
    }
}

