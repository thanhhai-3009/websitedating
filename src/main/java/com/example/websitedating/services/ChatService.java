package com.example.websitedating.services;

import com.example.websitedating.constants.CommonEnums.MessageType;
import com.example.websitedating.dto.ChatMessage;
import com.example.websitedating.models.Chat;
import com.example.websitedating.models.User;
import com.example.websitedating.repository.ChatRepository;
import com.example.websitedating.repository.UserRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

@Service
public class ChatService {

    private final ChatRepository chatRepository;
    private final UserRepository userRepository;

    public ChatService(ChatRepository chatRepository, UserRepository userRepository) {
        this.chatRepository = chatRepository;
        this.userRepository = userRepository;
    }

    public ChatMessage saveIncomingMessage(ChatMessage incoming, String principalName) {
        if (incoming == null || incoming.getRoomId() == null || incoming.getRoomId().isBlank()) {
            throw new IllegalArgumentException("roomId is required");
        }

        String roomId = incoming.getRoomId().trim();
        String resolvedSenderId = resolveSenderId(incoming.getSenderId(), principalName);
        Instant timestamp = incoming.getTimestamp() != null ? incoming.getTimestamp() : Instant.now();
        ChatMessage.Type messageType = incoming.getType() != null ? incoming.getType() : ChatMessage.Type.CHAT;

        Chat chat = chatRepository.findById(roomId).orElseGet(() -> Chat.builder()
                .id(roomId)
                .participants(extractParticipants(roomId))
                .messages(new ArrayList<>())
                .isActive(true)
                .build());

        if (chat.getMessages() == null) {
            chat.setMessages(new ArrayList<>());
        }

        Chat.Message message = Chat.Message.builder()
                .senderId(resolvedSenderId)
                .content(incoming.getContent())
                .type(toModelType(messageType))
                .timestamp(timestamp)
                .build();

        chat.getMessages().add(message);
        chat.setLastMessageAt(timestamp);
        chatRepository.save(chat);

        return ChatMessage.builder()
                .id(chat.getId() + "-" + chat.getMessages().size())
                .roomId(roomId)
                .senderId(resolvedSenderId)
                .content(incoming.getContent())
                .type(messageType)
                .timestamp(timestamp)
                .build();
    }

    public List<ChatMessage> getMessages(String roomId, String principalName) {
        if (roomId == null || roomId.isBlank()) {
            return Collections.emptyList();
        }

        Optional<Chat> chatOpt = chatRepository.findById(roomId.trim());
        if (chatOpt.isEmpty()) {
            return Collections.emptyList();
        }

        Chat chat = chatOpt.get();
        ensureCanAccess(chat, principalName);

        List<Chat.Message> messages = chat.getMessages();
        if (messages == null || messages.isEmpty()) {
            return Collections.emptyList();
        }

        List<ChatMessage> response = new ArrayList<>(messages.size());
        for (int index = 0; index < messages.size(); index++) {
            Chat.Message message = messages.get(index);
            response.add(ChatMessage.builder()
                    .id(chat.getId() + "-" + (index + 1))
                    .roomId(chat.getId())
                    .senderId(message.getSenderId())
                    .content(message.getContent())
                    .type(toDtoType(message.getType()))
                    .timestamp(message.getTimestamp())
                    .build());
        }
        return response;
    }

    private void ensureCanAccess(Chat chat, String principalName) {
        if (principalName == null || principalName.isBlank()) {
            throw new AccessDeniedException("Unauthorized");
        }

        Optional<User> userOpt = userRepository.findByClerkId(principalName)
                .or(() -> userRepository.findByEmailIgnoreCase(principalName.toLowerCase(Locale.ROOT)));

        if (userOpt.isEmpty()) {
            throw new AccessDeniedException("Unauthorized");
        }

        List<String> participants = chat.getParticipants();
        if (participants != null && !participants.isEmpty() && !participants.contains(userOpt.get().getId())) {
            throw new AccessDeniedException("You are not allowed to read this room");
        }
    }

    private String resolveSenderId(String senderId, String principalName) {
        if (principalName != null && !principalName.isBlank()) {
            Optional<User> byPrincipal = userRepository.findByClerkId(principalName)
                    .or(() -> userRepository.findByEmailIgnoreCase(principalName.toLowerCase(Locale.ROOT)));
            if (byPrincipal.isPresent()) {
                return byPrincipal.get().getId();
            }
        }

        if (senderId == null || senderId.isBlank()) {
            throw new IllegalArgumentException("senderId is required");
        }
        return senderId;
    }

    private List<String> extractParticipants(String roomId) {
        if (!roomId.startsWith("dm-")) {
            return new ArrayList<>();
        }

        String[] parts = roomId.substring(3).split("-");
        if (parts.length < 2) {
            return new ArrayList<>();
        }

        return new ArrayList<>(Arrays.asList(parts[0], parts[1]));
    }

    private MessageType toModelType(ChatMessage.Type type) {
        if (type == ChatMessage.Type.IMAGE) {
            return MessageType.image;
        }
        return MessageType.text;
    }

    private ChatMessage.Type toDtoType(MessageType type) {
        if (type == MessageType.image) {
            return ChatMessage.Type.IMAGE;
        }
        return ChatMessage.Type.CHAT;
    }
}

