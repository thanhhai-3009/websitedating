package com.example.websitedating.dto;

import com.example.websitedating.models.User;

public class UserResponse {

    private String id;
    private String email;
    private String username;
    private String clerkId;
    private String phone;
    private boolean isVerified;

    public static UserResponse from(User user) {
        UserResponse response = new UserResponse();
        response.id = user.getId();
        response.email = user.getEmail();
        response.username = user.getUsername();
        response.clerkId = user.getClerkId();
        response.phone = user.getPhone();
        response.isVerified = Boolean.TRUE.equals(user.getIsVerified());
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
}
