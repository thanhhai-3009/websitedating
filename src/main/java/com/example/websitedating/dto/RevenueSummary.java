package com.example.websitedating.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RevenueSummary {
    private String period; // e.g., "2024-03", "2024-Q1", "2024"
    private Long totalRevenue;
    private Long transactionCount;
}
