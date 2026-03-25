package com.example.websitedating.repository;

import com.example.websitedating.constants.CommonEnums.ReportStatus;
import com.example.websitedating.models.Report;
import java.util.List;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface ReportRepository extends MongoRepository<Report, String> {

    List<Report> findByReporterIdOrReportedUserId(String reporterId, String reportedUserId);

    List<Report> findByReportedUserId(String reportedUserId);

    List<Report> findByStatus(ReportStatus status);

    long countByReportedUserIdAndStatus(String reportedUserId, ReportStatus status);

    List<Report> findAllByOrderByCreatedAtDesc();
}
