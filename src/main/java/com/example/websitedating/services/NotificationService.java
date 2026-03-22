package com.example.websitedating.services;

import com.example.websitedating.constants.CommonEnums.NotificationType;
import com.example.websitedating.models.Notification;
import com.example.websitedating.models.User;
import com.example.websitedating.repository.NotificationRepository;
import com.example.websitedating.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;

    public NotificationService(NotificationRepository notificationRepository, UserRepository userRepository) {
        this.notificationRepository = notificationRepository;
        this.userRepository = userRepository;
    }

    public void createMatchNotification(String targetUserId, String matchedWithUserId) {
        User matchedUser = userRepository.findById(matchedWithUserId).orElse(null);
        String matchedUserName = matchedUser != null && matchedUser.getProfile() != null && matchedUser.getProfile().getPersonalInfo() != null && matchedUser.getProfile().getPersonalInfo().getName() != null
                ? matchedUser.getProfile().getPersonalInfo().getName()
                : (matchedUser != null ? matchedUser.getUsername() : "someone");
        String avatarUrl = matchedUser != null && matchedUser.getProfile() != null ? matchedUser.getProfile().getAvatarUrl() : "";

        Map<String, Object> data = new HashMap<>();
        data.put("matchedUserId", matchedWithUserId);
        data.put("matchedUserName", matchedUserName);
        data.put("matchedUserAvatar", avatarUrl);

        Notification notification = Notification.builder()
                .userId(targetUserId)
                .type(NotificationType.new_match)
                .content("You have a new match with " + matchedUserName + "!")
                .data(data)
                .isRead(false)
                .createdAt(Instant.now())
                .build();

        notificationRepository.save(notification);
    }

    public List<Notification> getUnreadNotifications(String clerkId) {
        User user = userRepository.findByClerkId(clerkId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        return notificationRepository.findByUserIdAndIsReadFalseOrderByCreatedAtDesc(user.getId());
    }

    public List<Notification> getAllNotifications(String clerkId) {
        User user = userRepository.findByClerkId(clerkId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(user.getId());
    }

    public void markAsRead(String notificationId, String clerkId) {
        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new IllegalArgumentException("Notification not found"));

        User user = userRepository.findByClerkId(clerkId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (!notification.getUserId().equals(user.getId())) {
            throw new IllegalArgumentException("Not authorized to modify this notification");
        }

        notification.setIsRead(true);
        notificationRepository.save(notification);
    }
}
