package com.example.websitedating.services;

import com.example.websitedating.constants.CommonEnums.NotificationChannel;
import com.example.websitedating.constants.CommonEnums.NotificationType;
import com.example.websitedating.dto.DateReviewRequest;
import com.example.websitedating.models.DateReview;
import com.example.websitedating.models.Notification;
import com.example.websitedating.models.User;
import com.example.websitedating.repository.DateReviewRepository;
import com.example.websitedating.repository.NotificationRepository;
import com.example.websitedating.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class DateReviewService {

    private final DateReviewRepository dateReviewRepository;
    private final UserRepository userRepository;
    private final NotificationRepository notificationRepository;

    /**
     * Tạo đánh giá mới sau bữa hẹn
     */
    public DateReview createReview(DateReviewRequest request, String reviewerUserId) {
        log.info("Creating date review for appointment: {} by reviewer: {}",
                request.getAppointmentId(), reviewerUserId);

        // Kiểm tra xem đã đánh giá cuộc hẹn này chưa
        Optional<DateReview> existingReview = dateReviewRepository
                .findByAppointmentIdAndReviewerUserId(request.getAppointmentId(), reviewerUserId);

        if (existingReview.isPresent()) {
            throw new IllegalStateException("Bạn đã đánh giá cuộc hẹn này rồi");
        }

        DateReview review = new DateReview();
        review.setAppointmentId(request.getAppointmentId());
        review.setReviewedUserId(request.getReviewedUserId());
        review.setReviewerUserId(reviewerUserId);
        review.setDidMeet(request.isDidMeet());
        review.setWhoAbsent(request.getWhoAbsent());
        review.setPhotoMatch(request.getPhotoMatch());
        review.setBehaviourTags(request.getBehaviourTags());
        review.setWantSimilar(request.isWantSimilar());
        review.setVerdict(request.getVerdict());
        review.setCreatedAt(LocalDateTime.now());

        DateReview savedReview = dateReviewRepository.save(review);

        // Xử lý logic sau khi lưu đánh giá
        processReviewImpact(savedReview, reviewerUserId);

        return savedReview;
    }

    /**
     * Kiểm tra xem user đã đánh giá cuộc hẹn chưa
     */
    public boolean hasReviewed(String appointmentId, String reviewerUserId) {
        return dateReviewRepository
                .findByAppointmentIdAndReviewerUserId(appointmentId, reviewerUserId)
                .isPresent();
    }

    /**
     * Lấy đánh giá theo appointment ID
     */
    public List<DateReview> getReviewsByAppointment(String appointmentId) {
        return dateReviewRepository.findByAppointmentId(appointmentId);
    }

    /**
     * Lấy tất cả đánh giá về một user
     */
    public List<DateReview> getReviewsForUser(String userId) {
        return dateReviewRepository.findByReviewedUserId(userId);
    }

    /**
     * Lấy đánh giá của một reviewer
     */
    public List<DateReview> getReviewsByReviewer(String reviewerUserId) {
        return dateReviewRepository.findByReviewerUserId(reviewerUserId);
    }

    /**
     * Xử lý tác động của đánh giá lên user được đánh giá và reviewer
     */
    private void processReviewImpact(DateReview review, String reviewerUserId) {
        String reviewedUserId = review.getReviewedUserId();

        // ── 1. Cập nhật user được đánh giá ────────────────────────────────
        User reviewedUser = userRepository.findById(reviewedUserId).orElse(null);
        if (reviewedUser != null) {
            int reputationChange = calculateReputationChange(review);

            Integer currentReputation = reviewedUser.getReputationScore();
            if (currentReputation == null) currentReputation = 100;
            int newReputation = Math.max(0, Math.min(100, currentReputation + reputationChange));
            reviewedUser.setReputationScore(newReputation);

            // Kiểm tra hành vi nghiêm trọng → tự động khóa 7 ngày
            boolean isSevereHarassment = review.getBehaviourTags() != null
                    && review.getBehaviourTags().contains("harass");
            if (isSevereHarassment || "negative".equals(review.getVerdict()) || "dangerous".equals(review.getVerdict())) {
                reviewedUser.setAccountLockedUntil(Instant.now().plus(7, ChronoUnit.DAYS));
                log.warn("User {} auto-locked 7 days – verdict: {} / harassment: {}",
                        reviewedUserId, review.getVerdict(), isSevereHarassment);
            }

            // Đánh dấu admin review nếu hành vi nguy hiểm
            if ("dangerous".equals(review.getVerdict())) {
                reviewedUser.setFlaggedForReview(true);
                log.warn("User {} flagged for admin review (dangerous behavior)", reviewedUserId);
            }

            // Ảnh giả / không trung thực
            if ("under50".equals(review.getPhotoMatch())) {
                reviewedUser.setFakePhotoReports(
                        reviewedUser.getFakePhotoReports() == null ? 1 : reviewedUser.getFakePhotoReports() + 1);
                log.info("User {} fake-photo report count: {}", reviewedUserId, reviewedUser.getFakePhotoReports());
            }

            // Bùng hẹn → trừ điểm uy tín
            if (!review.isDidMeet() && "them".equals(review.getWhoAbsent())) {
                reviewedUser.setNoShowCount(
                        reviewedUser.getNoShowCount() == null ? 1 : reviewedUser.getNoShowCount() + 1);
                newReputation = Math.max(0, newReputation - 20);
                reviewedUser.setReputationScore(newReputation);
                log.info("User {} no-show count: {}, reputation now: {}", reviewedUserId,
                        reviewedUser.getNoShowCount(), newReputation);
            }

            userRepository.save(reviewedUser);

            // ── Gửi notification nếu >= 2 medium review ──────────────────
            long mediumCount = dateReviewRepository.findByReviewedUserId(reviewedUserId).stream()
                    .filter(r -> "medium".equals(r.getVerdict()))
                    .count();

            if (mediumCount >= 2) {
                sendProfileUpdateSuggestion(reviewedUserId, mediumCount);
            }
        }

        // ── 2. Lưu preference wantSimilar cho reviewer ────────────────────
        if (reviewerUserId != null && !reviewerUserId.isEmpty()) {
            updateReviewerPreference(reviewerUserId, reviewedUserId, review.isWantSimilar());
        }
    }

    /**
     * Gửi in-app notification gợi ý cập nhật hồ sơ khi >= 2 đánh giá "medium"
     */
    private void sendProfileUpdateSuggestion(String userId, long mediumCount) {
        // Tránh gửi trùng – chỉ gửi vào lần đầu đạt ngưỡng
        boolean alreadyNotified = notificationRepository
                .findByUserIdOrderByCreatedAtDesc(userId)
                .stream()
                .anyMatch(n -> NotificationType.profile_update_suggestion.equals(n.getType()));

        if (!alreadyNotified || mediumCount % 5 == 0) { // nhắc lại mỗi 5 đánh giá medium
            Notification notification = Notification.builder()
                    .userId(userId)
                    .type(NotificationType.profile_update_suggestion)
                    .channel(NotificationChannel.in_app)
                    .content("Hồ sơ của bạn đã nhận được phản hồi từ nhiều người. Hãy xem xét cập nhật ảnh đại diện và thông tin để tăng độ tin cậy! 💡")
                    .data(Map.of("mediumReviewCount", mediumCount, "action", "update_profile"))
                    .isRealtime(true)
                    .isRead(false)
                    .build();

            notificationRepository.save(notification);
            log.info("Profile-update suggestion notification sent to user {} (mediumCount={})", userId, mediumCount);
        }
    }

    /**
     * Cập nhật danh sách preferredSimilarUserIds của reviewer
     * để tối ưu thuật toán gợi ý (Discovery)
     */
    private void updateReviewerPreference(String reviewerUserId, String reviewedUserId, boolean wantSimilar) {
        // Tìm user reviewer bằng clerkId hoặc id
        User reviewer = userRepository.findByClerkId(reviewerUserId)
                .or(() -> userRepository.findById(reviewerUserId))
                .orElse(null);

        if (reviewer == null) return;

        if (reviewer.getPreferences() == null) {
            reviewer.setPreferences(User.Preferences.builder().build());
        }

        List<String> similarIds = reviewer.getPreferences().getPreferredSimilarUserIds();
        if (similarIds == null) {
            similarIds = new ArrayList<>();
            reviewer.getPreferences().setPreferredSimilarUserIds(similarIds);
        }

        if (wantSimilar && !similarIds.contains(reviewedUserId)) {
            similarIds.add(reviewedUserId);
            userRepository.save(reviewer);
            log.info("Reviewer {} marked {} as preferred-similar", reviewerUserId, reviewedUserId);
        } else if (!wantSimilar) {
            similarIds.remove(reviewedUserId);
            userRepository.save(reviewer);
            log.info("Reviewer {} removed {} from preferred-similar", reviewerUserId, reviewedUserId);
        }
    }

    /**
     * Tính toán thay đổi reputation dựa trên verdict
     */
    private int calculateReputationChange(DateReview review) {
        int change = 0;

        switch (review.getVerdict()) {
            case "good" -> change += 5;
            case "negative" -> change -= 10;
            case "dangerous" -> change -= 30;
            default -> { /* medium – no change */ }
        }

        if (review.getBehaviourTags() != null) {
            for (String tag : review.getBehaviourTags()) {
                switch (tag) {
                    case "polite", "engaging" -> change += 5;
                    case "rude" -> change -= 10;
                    case "harass" -> change -= 30;
                }
            }
        }

        return change;
    }

    /**
     * Lấy thống kê đánh giá của một user
     */
    public ReviewStats getReviewStats(String userId) {
        List<DateReview> reviews = dateReviewRepository.findByReviewedUserId(userId);

        long goodCount = reviews.stream().filter(r -> "good".equals(r.getVerdict())).count();
        long mediumCount = reviews.stream().filter(r -> "medium".equals(r.getVerdict())).count();
        long negativeCount = reviews.stream().filter(r -> "negative".equals(r.getVerdict())).count();
        long dangerousCount = reviews.stream().filter(r -> "dangerous".equals(r.getVerdict())).count();

        return ReviewStats.builder()
                .totalReviews(reviews.size())
                .goodCount(goodCount)
                .mediumCount(mediumCount)
                .negativeCount(negativeCount)
                .dangerousCount(dangerousCount)
                .build();
    }

    /**
     * DTO cho thống kê đánh giá
     */
    @lombok.Builder
    @lombok.Data
    public static class ReviewStats {
        private long totalReviews;
        private long goodCount;
        private long mediumCount;
        private long negativeCount;
        private long dangerousCount;
    }
}
