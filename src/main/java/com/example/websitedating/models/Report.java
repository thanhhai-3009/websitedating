package com.example.websitedating.models;

import com.example.websitedating.constants.CommonEnums.*;
import lombok.*;
import org.springframework.data.annotation.*;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;
import java.util.List;

@Document("reports")
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class Report {
    @Id private String id;
    private String reporterId;
    private String reportedUserId;
    private ReportCategory reasonCategory;
    private String reason;
    private List<String> evidenceUrls;
    @Builder.Default private Boolean isUrgent = false;
    @Builder.Default private ReportStatus status = ReportStatus.pending;
    @CreatedDate private Instant createdAt;
}
