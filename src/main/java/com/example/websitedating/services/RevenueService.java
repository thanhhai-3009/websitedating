package com.example.websitedating.services;

import com.example.websitedating.dto.RevenueSummary;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationResults;
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

    public byte[] generateCsv(List<RevenueSummary> stats, String type) {
        StringBuilder csv = new StringBuilder();
        // UTF-8 BOM for Excel support
        csv.append('\ufeff');
        csv.append("Period,Transaction Count,Total Revenue (VND)\n");
        for (RevenueSummary s : stats) {
            csv.append(String.format("%s,%d,%d\n", s.getPeriod(), s.getTransactionCount(), s.getTotalRevenue()));
        }
        return csv.toString().getBytes(StandardCharsets.UTF_8);
    }
}
