package com.example.websitedating.services;

import com.example.websitedating.constants.CommonEnums.ReportCategory;
import com.example.websitedating.constants.CommonEnums.ReportStatus;
import com.example.websitedating.dto.AdminReportResponse;
import com.example.websitedating.models.Block;
import com.example.websitedating.models.Report;
import com.example.websitedating.models.User;
import com.example.websitedating.repository.BlockRepository;
import com.example.websitedating.repository.ConnectionRepository;
import com.example.websitedating.repository.ReportRepository;
import com.example.websitedating.repository.UserRepository;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ModerationService {

    private static final Set<ReportCategory> AUTO_BLOCK_CATEGORIES = Set.of(
            ReportCategory.harassment,
            ReportCategory.scam,
            ReportCategory.fake_profile
    );

    private final UserRepository userRepository;
    private final BlockRepository blockRepository;
    private final ReportRepository reportRepository;
    private final ConnectionRepository connectionRepository;

    public ModerationService(
            UserRepository userRepository,
            BlockRepository blockRepository,
            ReportRepository reportRepository,
            ConnectionRepository connectionRepository) {
        this.userRepository = userRepository;
        this.blockRepository = blockRepository;
        this.reportRepository = reportRepository;
        this.connectionRepository = connectionRepository;
    }

    // ─── BLOCK ────────────────────────────────────────────────────────────────

    public void blockUser(String clerkId, String targetUserId, String reason) {
        User me = findByClerkId(clerkId);
        if (me.getId().equals(targetUserId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot block yourself");
        }
        // Verify target exists
        userRepository.findById(targetUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Target user not found"));

        if (blockRepository.existsByBlockerIdAndBlockedUserId(me.getId(), targetUserId)) {
            return; // already blocked — idempotent
        }

        Block block = Block.builder()
                .blockerId(me.getId())
                .blockedUserId(targetUserId)
                .reason(reason)
                .build();
        blockRepository.save(block);

        // Remove any existing connection between the two users
        removeConnection(me.getId(), targetUserId);
    }

    public void unblockUser(String clerkId, String targetUserId) {
        User me = findByClerkId(clerkId);
        blockRepository.deleteByBlockerIdAndBlockedUserId(me.getId(), targetUserId);
    }

    public List<User> getBlockedUsers(String clerkId) {
        User me = findByClerkId(clerkId);
        List<Block> blocks = blockRepository.findByBlockerId(me.getId());

        Set<String> blockedIds = blocks.stream()
                .map(Block::getBlockedUserId)
                .collect(Collectors.toSet());

        if (blockedIds.isEmpty()) return List.of();
        return userRepository.findAllById(blockedIds);
    }

    public boolean isBlocked(String clerkId, String targetUserId) {
        User me = findByClerkId(clerkId);
        return blockRepository.existsByBlockerIdAndBlockedUserId(me.getId(), targetUserId);
    }

    // ─── REPORT ───────────────────────────────────────────────────────────────

    public Report reportUser(String clerkId, String reportedUserId, ReportCategory category,
                             String reason, List<String> evidenceUrls) {
        User me = findByClerkId(clerkId);
        if (me.getId().equals(reportedUserId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot report yourself");
        }
        userRepository.findById(reportedUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Reported user not found"));

        boolean isUrgent = AUTO_BLOCK_CATEGORIES.contains(category);

        Report report = Report.builder()
                .reporterId(me.getId())
                .reportedUserId(reportedUserId)
                .reasonCategory(category)
                .reason(reason)
                .evidenceUrls(evidenceUrls)
                .isUrgent(isUrgent)
                .status(ReportStatus.pending)
                .build();

        Report saved = reportRepository.save(report);

        // Auto-block for severe categories
        if (isUrgent && !blockRepository.existsByBlockerIdAndBlockedUserId(me.getId(), reportedUserId)) {
            blockUser(clerkId, reportedUserId, "Auto-blocked due to report: " + category);
        }

        return saved;
    }

    // ─── ADMIN: REPORTS ───────────────────────────────────────────────────────

    public List<AdminReportResponse> getAllReports(ReportStatus status) {
        List<Report> reports = (status == null)
                ? reportRepository.findAllByOrderByCreatedAtDesc()
                : reportRepository.findByStatus(status);

        return reports.stream().map(report -> {
            User reporter = userRepository.findById(report.getReporterId()).orElse(null);
            User reported = userRepository.findById(report.getReportedUserId()).orElse(null);
            return AdminReportResponse.from(report, reporter, reported);
        }).collect(Collectors.toList());
    }

    public AdminReportResponse resolveReport(String reportId, ReportStatus newStatus) {
        Report report = reportRepository.findById(reportId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Report not found"));
        report.setStatus(newStatus);
        reportRepository.save(report);

        User reporter = userRepository.findById(report.getReporterId()).orElse(null);
        User reported = userRepository.findById(report.getReportedUserId()).orElse(null);
        return AdminReportResponse.from(report, reporter, reported);
    }

    // ─── ADMIN: BAN ───────────────────────────────────────────────────────────

    public User banUser(String userId, String reason) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        user.setIsBanned(true);
        user.setBanReason(reason);
        user.setBannedAt(Instant.now());
        return userRepository.save(user);
    }

    public User unbanUser(String userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        user.setIsBanned(false);
        user.setBanReason(null);
        user.setBannedAt(null);
        return userRepository.save(user);
    }

    // ─── HELPERS ──────────────────────────────────────────────────────────────

    private User findByClerkId(String clerkId) {
        return userRepository.findByClerkId(clerkId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    }

    private void removeConnection(String userIdA, String userIdB) {
        var connections = connectionRepository.findBySenderIdOrReceiverId(userIdA, userIdB);
        connections.stream()
                .filter(c -> isParticipant(c.getSenderId(), c.getReceiverId(), userIdA, userIdB))
                .forEach(c -> connectionRepository.deleteById(c.getId()));
    }

    private boolean isParticipant(String senderId, String receiverId, String a, String b) {
        return (a.equals(senderId) && b.equals(receiverId))
                || (b.equals(senderId) && a.equals(receiverId));
    }
}
