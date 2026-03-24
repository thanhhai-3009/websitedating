package com.example.websitedating.dto;

import com.example.websitedating.constants.CommonEnums.ReportCategory;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import lombok.Data;

@Data
public class ReportRequest {
    @NotBlank
    private String clerkId;
    @NotBlank
    private String reportedUserId;
    @NotNull
    private ReportCategory reasonCategory;
    private String reason;
    private List<String> evidenceUrls;
}
