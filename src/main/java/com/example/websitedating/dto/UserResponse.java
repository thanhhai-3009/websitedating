package com.example.websitedating.dto;

import com.example.websitedating.models.User;
import java.time.Instant;

public class UserResponse {

    private String id;
    private String email;
    private String username;
    private String clerkId;
    private String phone;
    private boolean isVerified;
    private String role;
    private String premiumPlan;
    private Instant premiumExpiresAt;
    private boolean premiumActive;

    public static UserResponse from(User user) {
        UserResponse response = new UserResponse();
        response.id = user.getId();
        response.email = user.getEmail();
        response.username = user.getUsername();
        response.clerkId = user.getClerkId();
        response.phone = user.getPhone();
        response.isVerified = Boolean.TRUE.equals(user.getIsVerified());
        response.role = user.getRole();
        response.premiumPlan = user.getPremiumPlan();
        response.premiumExpiresAt = user.getPremiumExpiresAt();
        response.premiumActive = user.hasActivePremium();
        return response;
    }

    public String getId() {
        return id;
    }

    public String getEmail() {
        return email;
    }

    public String getUsername() {
        return username;
    }

    public String getClerkId() {
        return clerkId;
    }

    public String getPhone() {
        return phone;
    }

    public boolean isVerified() {
        return isVerified;
    }

    public String getRole() {
        return role;
    }

    public String getPremiumPlan() {
        return premiumPlan;
    }

    public Instant getPremiumExpiresAt() {
        return premiumExpiresAt;
    }

    public boolean isPremiumActive() {
        return premiumActive;
    }
}
