package com.example.websitedating.models;

import com.example.websitedating.constants.CommonEnums.*;
import lombok.*;
import org.springframework.data.annotation.*;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;
import java.util.Map;

@Document("notifications")
@Data @Builder @NoArgsConstructor @AllArgsConstructor
@CompoundIndex(name = "user_read_createdAt_idx", def = "{'userId':1,'isRead':1,'createdAt':-1}")
public class Notification {
    @Id private String id;
    private String userId;
    private NotificationType type;
    private String content;
    private Map<String, Object> data;
    @Builder.Default private NotificationChannel channel = NotificationChannel.in_app;
    @Builder.Default private Boolean isRealtime = true;
    @Builder.Default private Boolean isRead = false;
    @CreatedDate private Instant createdAt;
}