package com.example.websitedating.services;

import com.example.websitedating.dto.RevenueSummary;
import com.example.websitedating.dto.DetailedRevenueExport;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationResults;
import org.springframework.data.mongodb.core.aggregation.ArrayOperators;
import org.springframework.data.mongodb.core.aggregation.ConditionalOperators;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.stereotype.Service;

@Service
public class RevenueService {

    private final MongoTemplate mongoTemplate;

    public RevenueService(MongoTemplate mongoTemplate) {
        this.mongoTemplate = mongoTemplate;
    }

    public List<RevenueSummary> getMonthlyRevenue() {
        Aggregation aggregation = Aggregation.newAggregation(
                Aggregation.match(Criteria.where("status").is("SUCCESS")),
                Aggregation.project("amount")
                        .andExpression("year(paidAt)").as("year")
                        .andExpression("month(paidAt)").as("month"),
                Aggregation.group("year", "month")
                        .sum("amount").as("totalRevenue")
                        .count().as("transactionCount"),
                Aggregation.sort(Sort.Direction.DESC, "_id.year", "_id.month")
        );

        AggregationResults<Map> results = mongoTemplate.aggregate(aggregation, "payment_transactions", Map.class);
        return results.getMappedResults().stream()
                .map(map -> {
                    Map id = (Map) map.get("_id");
                    return RevenueSummary.builder()
                        .period(id.get("year") + "-" + String.format("%02d", id.get("month")))
                        .totalRevenue(((Number) map.get("totalRevenue")).longValue())
                        .transactionCount(((Number) map.get("transactionCount")).longValue())
                        .build();
                })
                .collect(Collectors.toList());
    }

    public List<RevenueSummary> getQuarterlyRevenue() {
        Aggregation aggregation = Aggregation.newAggregation(
                Aggregation.match(Criteria.where("status").is("SUCCESS")),
                Aggregation.project("amount")
                        .andExpression("year(paidAt)").as("year")
                        .andExpression("month(paidAt)").as("month"),
                Aggregation.project("amount", "year")
                        .andExpression("ceil(month / 3.0)").as("quarter"),
                Aggregation.group("year", "quarter")
                        .sum("amount").as("totalRevenue")
                        .count().as("transactionCount"),
                Aggregation.sort(Sort.Direction.DESC, "_id.year", "_id.quarter")
        );

        AggregationResults<Map> results = mongoTemplate.aggregate(aggregation, "payment_transactions", Map.class);
        return results.getMappedResults().stream()
                .map(map -> {
                    Map id = (Map) map.get("_id");
                    return RevenueSummary.builder()
                        .period(id.get("year") + "-Q" + ((Number) id.get("quarter")).intValue())
                        .totalRevenue(((Number) map.get("totalRevenue")).longValue())
                        .transactionCount(((Number) map.get("transactionCount")).longValue())
                        .build();
                })
                .collect(Collectors.toList());
    }

    public List<RevenueSummary> getYearlyRevenue() {
        Aggregation aggregation = Aggregation.newAggregation(
                Aggregation.match(Criteria.where("status").is("SUCCESS")),
                Aggregation.project("amount")
                        .andExpression("year(paidAt)").as("year"),
                Aggregation.group("year")
                        .sum("amount").as("totalRevenue")
                        .count().as("transactionCount"),
                Aggregation.sort(Sort.Direction.DESC, "_id")
        );

        AggregationResults<Map> results = mongoTemplate.aggregate(aggregation, "payment_transactions", Map.class);
        return results.getMappedResults().stream()
                .map(map -> RevenueSummary.builder()
                        .period(String.valueOf(map.get("_id")))
                        .totalRevenue(((Number) map.get("totalRevenue")).longValue())
                        .transactionCount(((Number) map.get("transactionCount")).longValue())
                        .build())
                .collect(Collectors.toList());
    }

    public List<DetailedRevenueExport> getDetailedRevenue() {
        Aggregation aggregation = Aggregation.newAggregation(
                Aggregation.match(Criteria.where("status").is("SUCCESS")),
                // Dual lookup: by userId (_id) or clerkId
                Aggregation.lookup("users", "userId", "_id", "userById"),
                Aggregation.lookup("users", "clerkId", "clerkId", "userByClerk"),
                Aggregation.project()
                        .and("_id").as("transactionId")
                        .and("orderId").as("orderId")
                        .and("paidAt").as("paidAt")
                        .and("planId").as("planId")
                        .and("amount").as("grossAmount")
                        .and("userId").as("userId")
                        .and(ConditionalOperators.ifNull(ArrayOperators.arrayOf("userById").elementAt(0))
                                .then(ArrayOperators.arrayOf("userByClerk").elementAt(0)))
                        .as("userDetails"),
                Aggregation.unwind("userDetails", true),
                Aggregation.project()
                        .and("transactionId").as("transactionId")
                        .and("orderId").as("orderId")
                        .and("paidAt").as("paidAt")
                        .and("planId").as("planId")
                        .and("grossAmount").as("grossAmount")
                        .and("userId").as("userId")
                        .and("userDetails.username").as("username")
                        .and("userDetails.email").as("email")
        );

        AggregationResults<Map> results = mongoTemplate.aggregate(aggregation, "payment_transactions", Map.class);
        return results.getMappedResults().stream()
                .map(map -> {
                    long grossAmount = ((Number) map.getOrDefault("grossAmount", 0L)).longValue();
                    long platformFee = (grossAmount * 5) / 100;
                    long tax = (grossAmount * 10) / 100;
                    long netRevenue = grossAmount - platformFee - tax;

                    Object paidAt = map.get("paidAt");
                    String isoDate = "N/A";
                    if (paidAt != null) {
                        if (paidAt instanceof java.util.Date) {
                            isoDate = ((java.util.Date) paidAt).toInstant().toString().substring(0, 10);
                        } else if (paidAt instanceof java.time.Instant) {
                            isoDate = ((java.time.Instant) paidAt).toString().substring(0, 10);
                        }
                    }

                    // Ensure mandatory fields are not empty
                    String transactionId = String.valueOf(map.getOrDefault("transactionId", "MISSING_ID"));
                    String username = String.valueOf(map.getOrDefault("username", "MISSING_USER"));
                    String email = String.valueOf(map.getOrDefault("email", "MISSING_EMAIL"));
                    
                    // Cleanup for CSV
                    username = username.replace(",", " ").trim();
                    email = email.replace(",", " ").trim();

                    return DetailedRevenueExport.builder()
                        .transactionId(transactionId)
                        .orderId(String.valueOf(map.getOrDefault("orderId", "N/A")))
                        .date(isoDate)
                        .planId(String.valueOf(map.getOrDefault("planId", "N/A")))
                        .grossAmount(grossAmount)
                        .platformFee(platformFee)
                        .tax(tax)
                        .netRevenue(netRevenue)
                        .userId(String.valueOf(map.getOrDefault("userId", "N/A")))
                        .username(username)
                        .email(email)
                        .build();
                })
                .collect(Collectors.toList());
    }

    public byte[] generateDetailedCsv(List<DetailedRevenueExport> stats) {
        StringBuilder csv = new StringBuilder();
        // UTF-8 BOM for Excel support
        csv.append('\ufeff');
        
        String lineSeparator = "\r\n";
        String dateNow = java.time.LocalDate.now().toString();

        // Title and Metadata to make it look prominent
        csv.append("REVENUE STATISTICS REPORT").append(lineSeparator);
        csv.append("Export Date: ").append(dateNow).append(lineSeparator);
        csv.append(lineSeparator); // Empty line for spacing
        
        // Headers with Quoted Padding to force Excel column width
        csv.append("\"Transaction_ID          \",")
           .append("\"Order_ID                \",")
           .append("\"Date        \",")
           .append("\"Plan_ID   \",")
           .append("\"Gross_Amount \",")
           .append("\"Platform_Fee \",")
           .append("\"Tax          \",")
           .append("\"Net_Revenue  \",")
           .append("\"User_ID                \",")
           .append("\"Username             \",")
           .append("\"Email                          \"")
           .append(lineSeparator);
        
        for (DetailedRevenueExport s : stats) {
            csv.append(String.format("%s,%s,%s,%s,%d,%d,%d,%d,%s,%s,%s",
                s.getTransactionId(),
                s.getOrderId(),
                s.getDate(),
                s.getPlanId(),
                s.getGrossAmount(),
                s.getPlatformFee(),
                s.getTax(),
                s.getNetRevenue(),
                s.getUserId(),
                s.getUsername(),
                s.getEmail()
            )).append(lineSeparator);
        }
        return csv.toString().getBytes(StandardCharsets.UTF_8);
    }
}
