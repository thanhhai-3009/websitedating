package com.example.websitedating.dto;

import com.example.websitedating.models.User;
import java.time.Instant;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class AdminUserResponse {
    private String id;
    private String clerkId;
    private String username;
    private String email;
    private String role;
    private Boolean isVerified;
    private Boolean isBanned;
    private String banReason;
    private Instant createdAt;
    private ProfileDto profile;

    @Data
    @Builder
    public static class ProfileDto {
        private String avatarUrl;
    }

    public static AdminUserResponse from(User user) {
        ProfileDto profileDto = null;
        if (user.getProfile() != null) {
            profileDto = ProfileDto.builder()
                    .avatarUrl(user.getProfile().getAvatarUrl())
                    .build();
        }

        return AdminUserResponse.builder()
                .id(user.getId())
                .clerkId(user.getClerkId())
                .username(user.getUsername())
                .email(user.getEmail())
                .role(user.getRole())
                .isVerified(user.getIsVerified())
                .isBanned(user.getIsBanned())
                .banReason(user.getBanReason())
                .createdAt(user.getCreatedAt())
                .profile(profileDto)
                .build();
    }
}
