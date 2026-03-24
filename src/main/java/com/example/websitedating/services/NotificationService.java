package com.example.websitedating.services;

import com.example.websitedating.constants.CommonEnums.NotificationType;
import com.example.websitedating.models.Notification;
import com.example.websitedating.models.User;
import com.example.websitedating.repository.NotificationRepository;
import com.example.websitedating.repository.UserRepository;
import org.springframework.messaging.simp.SimpMessageSendingOperations;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final SimpMessageSendingOperations messageSendingOperations;

    public NotificationService(
            NotificationRepository notificationRepository,
            UserRepository userRepository,
            SimpMessageSendingOperations messageSendingOperations) {
        this.notificationRepository = notificationRepository;
        this.userRepository = userRepository;
        this.messageSendingOperations = messageSendingOperations;
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
                .content("You are now matched with " + matchedUserName + ".")
                .data(data)
                .isRead(false)
                .createdAt(Instant.now())
                .build();

        persistAndPush(notification);
    }

    public void createConnectionLikedNotification(String targetUserId, String likedByUserId) {
        User likedByUser = userRepository.findById(likedByUserId).orElse(null);
        String likedByUserName = likedByUser != null && likedByUser.getProfile() != null && likedByUser.getProfile().getPersonalInfo() != null && likedByUser.getProfile().getPersonalInfo().getName() != null
                ? likedByUser.getProfile().getPersonalInfo().getName()
                : (likedByUser != null ? likedByUser.getUsername() : "someone");
        String avatarUrl = likedByUser != null && likedByUser.getProfile() != null ? likedByUser.getProfile().getAvatarUrl() : "";

        Map<String, Object> data = new HashMap<>();
        data.put("likedByUserId", likedByUserId);
        data.put("likedByUserName", likedByUserName);
        data.put("likedByUserAvatar", avatarUrl);

        Notification notification = Notification.builder()
                .userId(targetUserId)
                .type(NotificationType.connection_liked)
                .content(likedByUserName + " liked your profile.")
                .data(data)
                .isRead(false)
                .createdAt(Instant.now())
                .build();

        persistAndPush(notification);
    }

    public void createMessageNotification(String targetUserId, String senderUserId, String roomId, String messageContent) {
        User sender = userRepository.findById(senderUserId).orElse(null);
        String senderName = sender != null && sender.getProfile() != null && sender.getProfile().getPersonalInfo() != null && sender.getProfile().getPersonalInfo().getName() != null
            ? sender.getProfile().getPersonalInfo().getName()
            : (sender != null ? sender.getUsername() : "Someone");
        String senderAvatar = sender != null && sender.getProfile() != null ? sender.getProfile().getAvatarUrl() : "";

        String normalizedContent = messageContent == null ? "" : messageContent.trim();
        String preview = normalizedContent.isBlank() ? "sent you a message" : normalizedContent;
        if (preview.length() > 80) {
            preview = preview.substring(0, 77) + "...";
        }

        Map<String, Object> data = new HashMap<>();
        data.put("roomId", roomId);
        data.put("senderUserId", senderUserId);
        data.put("senderName", senderName);
        data.put("senderAvatar", senderAvatar);
        data.put("preview", preview);

        Notification notification = Notification.builder()
            .userId(targetUserId)
            .type(NotificationType.new_message)
            .content(senderName + ": " + preview)
            .data(data)
            .isRead(false)
            .createdAt(Instant.now())
            .build();

        persistAndPush(notification);
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

    private void persistAndPush(Notification notification) {
        Notification saved = notificationRepository.save(notification);

        userRepository.findById(saved.getUserId())
                .map(User::getClerkId)
                .filter(clerkId -> clerkId != null && !clerkId.isBlank())
                .ifPresent(clerkId -> messageSendingOperations.convertAndSendToUser(
                        clerkId,
                        "/queue/notifications",
                        saved));
    }
}
