package com.example.websitedating.controllers;
import com.example.websitedating.dto.ChatMessage;
import com.example.websitedating.services.ChatService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
@RestController
@RequestMapping("/api/chats")
public class ChatRestController {
    private final ChatService chatService;
    public ChatRestController(ChatService chatService) {
        this.chatService = chatService;
    }
    @GetMapping("/rooms/{roomId}/messages")
    public List<ChatMessage> roomMessages(
            @PathVariable String roomId,
            @RequestParam(required = false) Integer limit) {
        return chatService.getRoomMessages(roomId, limit);
    }
}
