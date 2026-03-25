package com.example.websitedating.dto;

import com.example.websitedating.constants.CommonEnums.ReportCategory;
import com.example.websitedating.constants.CommonEnums.ReportStatus;
import com.example.websitedating.models.Report;
import com.example.websitedating.models.User;
import java.time.Instant;
import java.util.List;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class AdminReportResponse {
    private String id;
    private ReportCategory reasonCategory;
    private String reason;
    private List<String> evidenceUrls;
    private Boolean isUrgent;
    private ReportStatus status;
    private Instant createdAt;

    private UserInfo reporter;
    private UserInfo reportedUser;

    @Data
    @Builder
    public static class UserInfo {
        private String id;
        private String username;
        private String email;
        private String avatarUrl;
        private Boolean isBanned;
    }

    public static AdminReportResponse from(Report report, User reporter, User reportedUser) {
        return AdminReportResponse.builder()
                .id(report.getId())
                .reasonCategory(report.getReasonCategory())
                .reason(report.getReason())
                .evidenceUrls(report.getEvidenceUrls())
                .isUrgent(report.getIsUrgent())
                .status(report.getStatus())
                .createdAt(report.getCreatedAt())
                .reporter(toUserInfo(reporter))
                .reportedUser(toUserInfo(reportedUser))
                .build();
    }

    private static UserInfo toUserInfo(User user) {
        if (user == null) return null;
        return UserInfo.builder()
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .avatarUrl(user.getProfile() != null ? user.getProfile().getAvatarUrl() : null)
                .isBanned(user.getIsBanned())
                .build();
    }
}
