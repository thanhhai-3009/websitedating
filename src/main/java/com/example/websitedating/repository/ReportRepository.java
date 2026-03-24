package com.example.websitedating.repository;

import com.example.websitedating.models.Report;
import com.example.websitedating.constants.CommonEnums.ReportStatus;
import java.time.Instant;
import java.util.List;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface ReportRepository extends MongoRepository<Report, String> {

    List<Report> findByReporterIdOrReportedUserId(String reporterId, String reportedUserId);

    List<Report> findByReportedUserId(String reportedUserId);

    long countByReportedUserIdAndCreatedAtAfter(String reportedUserId, Instant since);

    List<Report> findByStatus(ReportStatus status);
}

