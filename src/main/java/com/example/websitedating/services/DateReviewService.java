package com.example.websitedating.services;

import com.example.websitedating.dto.DateReviewRequest;
import com.example.websitedating.models.DateReview;
import com.example.websitedating.models.User;
import com.example.websitedating.repository.DateReviewRepository;
import com.example.websitedating.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class DateReviewService {

    private final DateReviewRepository dateReviewRepository;
    private final UserRepository userRepository;

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
        processReviewImpact(savedReview);

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
     * Xử lý tác động của đánh giá lên user được đánh giá
     */
    private void processReviewImpact(DateReview review) {
        String reviewedUserId = review.getReviewedUserId();

        // Tính toán reputation score dựa trên verdict
        int reputationChange = calculateReputationChange(review);

        // Cập nhật user
        User user = userRepository.findById(reviewedUserId).orElse(null);
        if (user != null) {
            // Cập nhật reputation score
            Integer currentReputation = user.getReputationScore();
            if (currentReputation == null) {
                currentReputation = 100; // Default reputation
            }
            int newReputation = Math.max(0, Math.min(100, currentReputation + reputationChange));
            user.setReputationScore(newReputation);

            // Xử lý các trường hợp đặc biệt
            if ("dangerous".equals(review.getVerdict())) {
                // Đánh dấu user cần review bởi admin
                user.setFlaggedForReview(true);
                log.warn("User {} flagged for dangerous behavior", reviewedUserId);
            }

            if ("under50".equals(review.getPhotoMatch())) {
                // Đánh dấu ảnh không trung thực
                user.setFakePhotoReports(user.getFakePhotoReports() + 1);
                log.info("User {} reported for fake photo (count: {})",
                        reviewedUserId, user.getFakePhotoReports());
            }

            // Xử lý trường hợp không đến hẹn
            if (!review.isDidMeet() && "them".equals(review.getWhoAbsent())) {
                Integer noShowCount = user.getNoShowCount();
                user.setNoShowCount(noShowCount == null ? 1 : noShowCount + 1);
                log.info("User {} no-show count increased to {}",
                        reviewedUserId, user.getNoShowCount());
            }

            userRepository.save(user);
        }
    }

    /**
     * Tính toán thay đổi reputation dựa trên verdict
     */
    private int calculateReputationChange(DateReview review) {
        return switch (review.getVerdict()) {
            case "good" -> +5;
            case "medium" -> 0;
            case "negative" -> -10;
            case "dangerous" -> -30;
            default -> 0;
        };
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
