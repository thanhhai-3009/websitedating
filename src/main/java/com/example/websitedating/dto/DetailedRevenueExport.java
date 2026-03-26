package com.example.websitedating.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DetailedRevenueExport {
    // Transaction Info
    private String transactionId;
    private String orderId;
    private String date; // ISO 8601 (YYYY-MM-DD)

    // Product Info
    private String planId;

    // Financial Metrics
    private Long grossAmount;
    private Long platformFee;
    private Long tax;
    private Long netRevenue;

    // User Info
    private String userId;
    private String username;
    private String email;
}
