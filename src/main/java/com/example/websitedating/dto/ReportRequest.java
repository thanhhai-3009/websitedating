package com.example.websitedating.dto;

import com.example.websitedating.constants.CommonEnums.ReportCategory;
import java.util.List;
import lombok.Data;

@Data
public class ReportRequest {
    private String reporterClerkId;
    private String reportedUserId;
    private ReportCategory reasonCategory;
    private String reason;
    private List<String> evidenceUrls;
}
