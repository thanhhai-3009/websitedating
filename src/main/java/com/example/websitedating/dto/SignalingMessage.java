package com.example.websitedating.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SignalingMessage {
    private String roomId;
    private String senderId;
    private String targetId;
    private Type type;
    private String data;

    public enum Type {
        OFFER,
        ANSWER,
        ICE_CANDIDATE,
        LEAVE
    }
}

