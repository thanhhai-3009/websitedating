package com.example.websitedating.dto;

import com.example.websitedating.constants.CommonEnums.AccountStatus;
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
public class ViolationCaseResponse {
    private String userId;
    private String username;
    private String email;
    private String avatarUrl;
    private AccountStatus accountStatus;
    private Integer reportCount;
    private Instant bannedAt;
    private List<ReportDto> reports;

    @Data
    @Builder
    public static class ReportDto {
        private String id;
        private String reporterId;
        private ReportCategory reasonCategory;
        private String reason;
        private List<String> evidenceUrls;
        private ReportStatus status;
        private Instant createdAt;
    }

    public static ViolationCaseResponse from(User user, List<Report> reports) {
        List<ReportDto> reportDtos = reports.stream()
                .map(r -> ReportDto.builder()
                        .id(r.getId())
                        .reporterId(r.getReporterId())
                        .reasonCategory(r.getReasonCategory())
                        .reason(r.getReason())
                        .evidenceUrls(r.getEvidenceUrls())
                        .status(r.getStatus())
                        .createdAt(r.getCreatedAt())
                        .build())
                .toList();

        String avatarUrl = user.getProfile() != null ? user.getProfile().getAvatarUrl() : null;

        return ViolationCaseResponse.builder()
                .userId(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .avatarUrl(avatarUrl)
                .accountStatus(user.getAccountStatus())
                .reportCount(user.getReportCount())
                .bannedAt(user.getBannedAt())
                .reports(reportDtos)
                .build();
    }
}
