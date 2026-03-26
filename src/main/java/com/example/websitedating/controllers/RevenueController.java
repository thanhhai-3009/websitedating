package com.example.websitedating.controllers;

import com.example.websitedating.dto.RevenueSummary;
import com.example.websitedating.dto.DetailedRevenueExport;
import com.example.websitedating.services.RevenueService;
import java.util.List;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/revenue")
public class RevenueController {

    private final RevenueService revenueService;

    public RevenueController(RevenueService revenueService) {
        this.revenueService = revenueService;
    }

    @GetMapping("/stats")
    public ResponseEntity<List<RevenueSummary>> getStats(@RequestParam(defaultValue = "MONTH") String type) {
        List<RevenueSummary> stats;
        switch (type.toUpperCase()) {
            case "QUARTER":
                stats = revenueService.getQuarterlyRevenue();
                break;
            case "YEAR":
                stats = revenueService.getYearlyRevenue();
                break;
            default:
                stats = revenueService.getMonthlyRevenue();
                break;
        }
        return ResponseEntity.ok(stats);
    }

    @GetMapping("/export")
    public ResponseEntity<byte[]> exportCsv(@RequestParam(defaultValue = "MONTH") String type) {
        List<DetailedRevenueExport> stats = revenueService.getDetailedRevenue();
        byte[] csvData = revenueService.generateDetailedCsv(stats);
        
        int month = java.time.LocalDate.now().getMonthValue();
        String fileName = "Revenue_Month_" + month + ".csv";
        
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=" + fileName)
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(csvData);
    }
}
