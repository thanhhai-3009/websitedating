package com.example.websitedating.controllers;

import com.example.websitedating.dto.ChatMessage;
import com.example.websitedating.dto.SignalingMessage;
import com.example.websitedating.services.ChatService;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessageSendingOperations;
import org.springframework.stereotype.Controller;

@Controller
public class ChatController {

    private final SimpMessageSendingOperations messageSendingOperations;
    private final ChatService chatService;

    public ChatController(
            SimpMessageSendingOperations messageSendingOperations,
            ChatService chatService) {
        this.messageSendingOperations = messageSendingOperations;
        this.chatService = chatService;
    }

    @MessageMapping("/chat.sendMessage")
    public void sendMessage(ChatMessage chatMessage) {
        ChatMessage savedMessage = chatService.saveIncomingMessage(chatMessage);
        messageSendingOperations.convertAndSend("/topic/room/" + savedMessage.getRoomId(), savedMessage);
    }

    @MessageMapping("/webrtc.signal")
    public void signal(SignalingMessage signalingMessage) {
        messageSendingOperations.convertAndSend("/topic/room/" + signalingMessage.getRoomId(), signalingMessage);
    }
}
