package com.example.websitedating.models;

import com.example.websitedating.constants.CommonEnums.*;
import lombok.*;
import org.springframework.data.annotation.*;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.index.IndexDirection;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;

@Document("chats")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Chat {
    @Id
    private String id;

    @Indexed
    private List<String> participants;

    @Builder.Default
    private Boolean isActive = true;

    @Indexed(direction = IndexDirection.DESCENDING)
    private Instant lastMessageAt;

    private List<Message> messages;

    @CreatedDate
    private Instant createdAt;
    @LastModifiedDate
    private Instant updatedAt;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Message {
        private String senderId;
        private String content;
        @Builder.Default
        private MessageType type = MessageType.text;
        private List<Media> media;
        @Builder.Default
        private DeliveryStatus deliveryStatus = DeliveryStatus.sent;
        @Builder.Default
        private Instant timestamp = Instant.now();
        private Instant readAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Media {
        private MediaType mediaType;
        private String url;
        private Meta meta;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Meta {
        private Integer width;
        private Integer height;
        private Long size;
    }
}