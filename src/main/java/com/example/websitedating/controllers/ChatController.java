package com.example.websitedating.controllers;

import com.example.websitedating.dto.ChatMessage;
import com.example.websitedating.dto.SignalingMessage;
import com.example.websitedating.models.User;
import com.example.websitedating.repository.UserRepository;
import com.example.websitedating.services.ChatService;
import java.security.Principal;
import java.util.Optional;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessageSendingOperations;
import org.springframework.stereotype.Controller;

@Controller
public class ChatController {

    private final SimpMessageSendingOperations messageSendingOperations;
    private final ChatService chatService;
    private final UserRepository userRepository;

    public ChatController(
            SimpMessageSendingOperations messageSendingOperations,
            ChatService chatService,
            UserRepository userRepository) {
        this.messageSendingOperations = messageSendingOperations;
        this.chatService = chatService;
        this.userRepository = userRepository;
    }

    @MessageMapping("/chat.sendMessage")
    public void sendMessage(ChatMessage chatMessage, Principal principal) {
        String authenticatedDbUserId = resolveAuthenticatedDbUserId(principal);
        if (authenticatedDbUserId != null) {
            chatMessage.setSenderId(authenticatedDbUserId);
        }
        ChatMessage savedMessage = chatService.saveIncomingMessage(chatMessage);
        messageSendingOperations.convertAndSend("/topic/room/" + savedMessage.getRoomId(), savedMessage);
    }

    @MessageMapping("/webrtc.signal")
    public void signal(SignalingMessage signalingMessage, Principal principal) {
        String authenticatedClerkId = principal != null ? principal.getName() : null;
        if (authenticatedClerkId != null && !authenticatedClerkId.isBlank()) {
            signalingMessage.setSenderId(authenticatedClerkId);
        }
        messageSendingOperations.convertAndSend("/topic/room/" + signalingMessage.getRoomId(), signalingMessage);
    }

    private String resolveAuthenticatedDbUserId(Principal principal) {
        String authenticated = principal == null ? null : principal.getName();
        if (authenticated == null || authenticated.isBlank()) {
            return null;
        }

        Optional<User> byClerkId = userRepository.findByClerkId(authenticated);
        if (byClerkId.isPresent()) {
            return byClerkId.get().getId();
        }

        return userRepository.findByEmailIgnoreCase(authenticated)
                .map(User::getId)
                .orElse(null);
    }
}
