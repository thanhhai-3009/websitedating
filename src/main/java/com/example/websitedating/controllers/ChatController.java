package com.example.websitedating.controllers;

import com.example.websitedating.dto.ChatMessage;
import com.example.websitedating.dto.SignalingMessage;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessageSendingOperations;
import org.springframework.stereotype.Controller;

@Controller
public class ChatController {

    private final SimpMessageSendingOperations messageSendingOperations;

    public ChatController(SimpMessageSendingOperations messageSendingOperations) {
        this.messageSendingOperations = messageSendingOperations;
    }

    @MessageMapping("/chat.sendMessage")
    public void sendMessage(ChatMessage chatMessage) {
        messageSendingOperations.convertAndSend("/topic/room/" + chatMessage.getRoomId(), chatMessage);
    }

    @MessageMapping("/webrtc.signal")
    public void signal(SignalingMessage signalingMessage) {
        messageSendingOperations.convertAndSend("/topic/room/" + signalingMessage.getRoomId(), signalingMessage);
    }
}
