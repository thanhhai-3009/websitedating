package com.example.websitedating.dto;

import java.time.Instant;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatMessage {
    private String id;
    private String roomId;
    private String senderId;
    private String content;
    private Type type;
    private Instant timestamp;

    public enum Type {
        CHAT,
        IMAGE,
        JOIN,
        LEAVE
    }
}
