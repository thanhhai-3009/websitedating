package com.example.websitedating.services;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import com.example.websitedating.dto.ChatMessage;
import com.example.websitedating.models.Chat;
import com.example.websitedating.repository.ChatRepository;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
@ExtendWith(MockitoExtension.class)
class ChatServiceTest {
    @Mock
    private ChatRepository chatRepository;
    private ChatService chatService;
    @BeforeEach
    void setUp() {
        chatService = new ChatService(chatRepository);
    }
    @Test
    void saveIncomingMessage_appendsToRoom() {
        Chat existing = Chat.builder()
                .id("dm-a-b")
                .messages(new java.util.ArrayList<>())
                .build();
        when(chatRepository.findById("dm-a-b")).thenReturn(Optional.of(existing));
        when(chatRepository.save(any(Chat.class))).thenAnswer(invocation -> invocation.getArgument(0));
        ChatMessage saved = chatService.saveIncomingMessage(ChatMessage.builder()
                .roomId("dm-a-b")
                .senderId("a")
                .content("hello")
                .type(ChatMessage.Type.CHAT)
                .timestamp(Instant.now())
                .build());
        ArgumentCaptor<Chat> captor = ArgumentCaptor.forClass(Chat.class);
        verify(chatRepository).save(captor.capture());
        assertEquals("dm-a-b", saved.getRoomId());
        assertEquals(1, captor.getValue().getMessages().size());
        assertEquals("hello", captor.getValue().getMessages().get(0).getContent());
    }
    @Test
    void getRoomMessages_returnsLatestItems() {
        Chat.Message first = Chat.Message.builder().senderId("a").content("1").type(com.example.websitedating.constants.CommonEnums.MessageType.text).timestamp(Instant.now().minusSeconds(60)).build();
        Chat.Message second = Chat.Message.builder().senderId("b").content("2").type(com.example.websitedating.constants.CommonEnums.MessageType.image).timestamp(Instant.now()).build();
        Chat chat = Chat.builder().id("dm-a-b").messages(List.of(first, second)).build();
        when(chatRepository.findById("dm-a-b")).thenReturn(Optional.of(chat));
        List<ChatMessage> values = chatService.getRoomMessages("dm-a-b", 1);
        assertEquals(1, values.size());
        assertEquals("2", values.get(0).getContent());
        assertEquals(ChatMessage.Type.IMAGE, values.get(0).getType());
    }
    @Test
    void getRoomMessages_emptyWhenMissingRoom() {
        when(chatRepository.findById("dm-x-y")).thenReturn(Optional.empty());
        List<ChatMessage> values = chatService.getRoomMessages("dm-x-y", 20);
        assertTrue(values.isEmpty());
    }
}
