package com.example.websitedating.repository;

import com.example.websitedating.models.Report;
import java.util.List;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface ReportRepository extends MongoRepository<Report, String> {

    List<Report> findByReporterIdOrReportedUserId(String reporterId, String reportedUserId);
}

