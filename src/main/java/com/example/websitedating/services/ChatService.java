package com.example.websitedating.services;
import com.example.websitedating.constants.CommonEnums.DeliveryStatus;
import com.example.websitedating.constants.CommonEnums.MessageType;
import com.example.websitedating.dto.ChatMessage;
import com.example.websitedating.models.Chat;
import com.example.websitedating.models.User;
import com.example.websitedating.repository.ChatRepository;
import com.example.websitedating.repository.UserRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
@Service
public class ChatService {

    private static final Logger log = LoggerFactory.getLogger(ChatService.class);

    private final ChatRepository chatRepository;
    private final NotificationService notificationService;
    private final UserRepository userRepository;
    private final WebSocketPresenceService webSocketPresenceService;

    public ChatService(
            ChatRepository chatRepository,
            NotificationService notificationService,
            UserRepository userRepository,
            WebSocketPresenceService webSocketPresenceService) {
        this.chatRepository = chatRepository;
        this.notificationService = notificationService;
        this.userRepository = userRepository;
        this.webSocketPresenceService = webSocketPresenceService;
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

        maybeCreateMessageNotification(chat, incoming, senderId);

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

    private void maybeCreateMessageNotification(Chat chat, ChatMessage incoming, String senderId) {
        try {
            Optional<String> recipientOpt = resolveRecipientUserId(chat, senderId, incoming.getRoomId());
            if (recipientOpt.isEmpty()) {
                return;
            }

            String recipientUserId = recipientOpt.get();
            if (recipientUserId.equals(senderId)) {
                return;
            }

            Optional<User> recipientUserOpt = userRepository.findById(recipientUserId);
            if (recipientUserOpt.isEmpty()) {
                return;
            }

            String recipientClerkId = recipientUserOpt.get().getClerkId();
            if (recipientClerkId != null
                    && webSocketPresenceService.isUserActiveInRoom(recipientClerkId, incoming.getRoomId())) {
                return;
            }

            notificationService.createMessageNotification(
                    recipientUserId,
                    senderId,
                    incoming.getRoomId(),
                    incoming.getContent());
        } catch (Exception ex) {
            log.warn("Failed to create message notification for room {}: {}", incoming.getRoomId(), ex.getMessage());
        }
    }

    private Optional<String> resolveRecipientUserId(Chat chat, String senderId, String roomId) {
        if (chat.getParticipants() != null && !chat.getParticipants().isEmpty()) {
            return chat.getParticipants()
                    .stream()
                    .filter(participantId -> participantId != null && !participantId.isBlank())
                    .filter(participantId -> !participantId.equals(senderId))
                    .findFirst();
        }

        if (roomId == null || !roomId.startsWith("dm-")) {
            return Optional.empty();
        }

        String[] ids = roomId.substring(3).split("-");
        if (ids.length < 2) {
            return Optional.empty();
        }

        if (ids[0].equals(senderId)) {
            return Optional.of(ids[1]);
        }
        if (ids[1].equals(senderId)) {
            return Optional.of(ids[0]);
        }
        return Optional.empty();
    }
}
