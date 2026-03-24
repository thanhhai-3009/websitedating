package com.example.websitedating.services;

import com.example.websitedating.constants.CommonEnums.AccountStatus;
import com.example.websitedating.constants.CommonEnums.ReportStatus;
import com.example.websitedating.dto.BlockRequest;
import com.example.websitedating.dto.ReportRequest;
import com.example.websitedating.dto.ViolationCaseResponse;
import com.example.websitedating.models.Block;
import com.example.websitedating.models.Report;
import com.example.websitedating.models.User;
import com.example.websitedating.repository.BlockRepository;
import com.example.websitedating.repository.ReportRepository;
import com.example.websitedating.repository.UserRepository;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ModerationService {

    // Ngưỡng: tổng (report + block) trong 24h để kích hoạt auto-ban
    private static final int BAN_THRESHOLD = 5;
    private static final int WINDOW_HOURS = 24;

    private final UserRepository userRepository;
    private final ReportRepository reportRepository;
    private final BlockRepository blockRepository;

    public ModerationService(UserRepository userRepository,
                             ReportRepository reportRepository,
                             BlockRepository blockRepository) {
        this.userRepository = userRepository;
        this.reportRepository = reportRepository;
        this.blockRepository = blockRepository;
    }

    // ─── User Actions ────────────────────────────────────────────────────────

    public void reportUser(ReportRequest req) {
        User reporter = findByClerkId(req.getReporterClerkId());
        User reported = userRepository.findById(req.getReportedUserId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        if (reporter.getId().equals(reported.getId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot report yourself");
        }

        Report report = Report.builder()
                .reporterId(reporter.getId())
                .reportedUserId(reported.getId())
                .reasonCategory(req.getReasonCategory())
                .reason(req.getReason())
                .evidenceUrls(req.getEvidenceUrls())
                .status(ReportStatus.pending)
                .build();
        reportRepository.save(report);

        checkAndAutoBan(reported);
    }

    public void blockUser(BlockRequest req) {
        User blocker = findByClerkId(req.getBlockerClerkId());
        User blocked = userRepository.findById(req.getBlockedUserId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        if (blocker.getId().equals(blocked.getId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot block yourself");
        }

        Block block = Block.builder()
                .blockerId(blocker.getId())
                .blockedUserId(blocked.getId())
                .reason(req.getReason())
                .build();
        try {
            blockRepository.save(block);
        } catch (Exception ignored) {
            // Duplicate block — đã chặn rồi, bỏ qua
        }

        checkAndAutoBan(blocked);
    }

    // ─── Auto-ban Logic ───────────────────────────────────────────────────────

    private void checkAndAutoBan(User target) {
        // Bỏ qua nếu đã bị ban vĩnh viễn hoặc đang chờ duyệt
        if (target.getAccountStatus() == AccountStatus.PERMANENTLY_BANNED
                || target.getAccountStatus() == AccountStatus.TEMPORARY_BANNED) {
            return;
        }

        // Bỏ qua nếu tài khoản vừa được restore (trong vòng 1 giờ) — tránh vòng lặp khóa
        if (target.getRestoredAt() != null
                && target.getRestoredAt().isAfter(Instant.now().minus(1, ChronoUnit.HOURS))) {
            return;
        }

        Instant windowStart = Instant.now().minus(WINDOW_HOURS, ChronoUnit.HOURS);
        long recentReports = reportRepository.countByReportedUserIdAndCreatedAtAfter(target.getId(), windowStart);
        long recentBlocks = blockRepository.countByBlockedUserIdAndCreatedAtAfter(target.getId(), windowStart);

        if (recentReports + recentBlocks >= BAN_THRESHOLD) {
            target.setAccountStatus(AccountStatus.TEMPORARY_BANNED);
            target.setReportCount((int) (recentReports + recentBlocks));
            target.setBannedAt(Instant.now());
            userRepository.save(target);
        }
    }

    // ─── Admin Actions ────────────────────────────────────────────────────────

    public List<ViolationCaseResponse> getPendingViolations() {
        return userRepository.findByAccountStatus(AccountStatus.TEMPORARY_BANNED).stream()
                .map(user -> {
                    List<Report> reports = reportRepository.findByReportedUserId(user.getId());
                    return ViolationCaseResponse.from(user, reports);
                })
                .toList();
    }

    public ViolationCaseResponse confirmBan(String userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        user.setAccountStatus(AccountStatus.PERMANENTLY_BANNED);
        userRepository.save(user);

        // Đánh dấu tất cả report liên quan là resolved
        List<Report> reports = reportRepository.findByReportedUserId(userId);
        reports.forEach(r -> r.setStatus(ReportStatus.resolved));
        reportRepository.saveAll(reports);

        return ViolationCaseResponse.from(user, reports);
    }

    public ViolationCaseResponse restoreAccount(String userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        user.setAccountStatus(AccountStatus.ACTIVE);
        user.setBannedAt(null);
        user.setRestoredAt(Instant.now()); // Đánh dấu thời điểm restore để tránh auto-ban ngay lập tức
        userRepository.save(user);

        // Đánh dấu report là reviewed (không phải resolved — admin đã xem xét và tha)
        List<Report> reports = reportRepository.findByReportedUserId(userId);
        reports.stream()
                .filter(r -> r.getStatus() == ReportStatus.pending)
                .forEach(r -> r.setStatus(ReportStatus.reviewed));
        reportRepository.saveAll(reports);

        return ViolationCaseResponse.from(user, reports);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private User findByClerkId(String clerkId) {
        return userRepository.findByClerkId(clerkId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    }
}
