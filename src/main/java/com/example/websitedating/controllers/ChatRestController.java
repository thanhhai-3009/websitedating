package com.example.websitedating.controllers;

import com.example.websitedating.dto.ChatMessage;
import com.example.websitedating.services.ChatService;
import java.security.Principal;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/chats")
public class ChatRestController {

    private final ChatService chatService;

    public ChatRestController(ChatService chatService) {
        this.chatService = chatService;
    }

    @GetMapping("/{roomId}/messages")
    public List<ChatMessage> messages(@PathVariable String roomId, Principal principal) {
        String principalName = principal != null ? principal.getName() : null;
        return chatService.getMessages(roomId, principalName);
    }
}

