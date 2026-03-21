package com.example.websitedating.services;
import com.example.websitedating.constants.CommonEnums.DeliveryStatus;
import com.example.websitedating.constants.CommonEnums.MessageType;
import com.example.websitedating.dto.ChatMessage;
import com.example.websitedating.models.Chat;
import com.example.websitedating.repository.ChatRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
@Service
public class ChatService {
    private final ChatRepository chatRepository;
    public ChatService(ChatRepository chatRepository) {
        this.chatRepository = chatRepository;
    }
    public ChatMessage saveIncomingMessage(ChatMessage incoming) {
        if (incoming == null || incoming.getRoomId() == null || incoming.getRoomId().isBlank()) {
            throw new IllegalArgumentException("roomId is required");
        }
        Instant timestamp = incoming.getTimestamp() == null ? Instant.now() : incoming.getTimestamp();
        String senderId = incoming.getSenderId() == null ? "unknown" : incoming.getSenderId();
        ChatMessage.Type incomingType = incoming.getType() == null ? ChatMessage.Type.CHAT : incoming.getType();
        Chat chat = chatRepository.findById(incoming.getRoomId())
                .orElseGet(() -> Chat.builder()
                        .id(incoming.getRoomId())
                        .participants(extractParticipants(incoming.getRoomId()))
                        .messages(new ArrayList<>())
                        .isActive(true)
                        .build());
        if (chat.getMessages() == null) {
            chat.setMessages(new ArrayList<>());
        }
        Chat.Message message = Chat.Message.builder()
                .senderId(senderId)
                .content(incoming.getContent())
                .type(toModelType(incomingType))
                .deliveryStatus(DeliveryStatus.sent)
                .timestamp(timestamp)
                .build();
        chat.getMessages().add(message);
        chat.setLastMessageAt(timestamp);
        chatRepository.save(chat);
        return ChatMessage.builder()
                .id(UUID.randomUUID().toString())
                .roomId(incoming.getRoomId())
                .senderId(senderId)
                .content(incoming.getContent())
                .type(incomingType)
                .timestamp(timestamp)
                .build();
    }
    public List<ChatMessage> getRoomMessages(String roomId, Integer limit) {
        if (roomId == null || roomId.isBlank()) {
            return List.of();
        }
        int effectiveLimit = limit == null || limit <= 0 ? 100 : Math.min(limit, 300);
        Chat chat = chatRepository.findById(roomId).orElse(null);
        if (chat == null || chat.getMessages() == null || chat.getMessages().isEmpty()) {
            return List.of();
        }
        List<Chat.Message> source = chat.getMessages();
        int fromIndex = Math.max(0, source.size() - effectiveLimit);
        List<ChatMessage> result = new ArrayList<>();
        for (int i = fromIndex; i < source.size(); i++) {
            Chat.Message value = source.get(i);
            result.add(ChatMessage.builder()
                    .id(roomId + "-" + i)
                    .roomId(roomId)
                    .senderId(value.getSenderId())
                    .content(value.getContent())
                    .type(toDtoType(value.getType()))
                    .timestamp(value.getTimestamp())
                    .build());
        }
        return result;
    }
    private List<String> extractParticipants(String roomId) {
        if (!roomId.startsWith("dm-")) {
            return List.of();
        }
        String value = roomId.substring(3);
        String[] ids = value.split("-");
        if (ids.length < 2) {
            return List.of();
        }
        return List.of(ids[0], ids[1]);
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
