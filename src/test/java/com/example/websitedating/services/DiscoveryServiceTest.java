package com.example.websitedating.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.websitedating.constants.CommonEnums.ConnectionStatus;
import com.example.websitedating.constants.CommonEnums.InteractionType;
import com.example.websitedating.constants.CommonEnums.RecentActionType;
import com.example.websitedating.dto.RecordInteractionRequest;
import com.example.websitedating.models.Connection;
import com.example.websitedating.models.User;
import com.example.websitedating.repository.BlockRepository;
import com.example.websitedating.repository.ConnectionRepository;
import com.example.websitedating.repository.MatchSuggestionRepository;
import com.example.websitedating.repository.ReportRepository;
import com.example.websitedating.repository.UserRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;

@ExtendWith(MockitoExtension.class)
class DiscoveryServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private ConnectionRepository connectionRepository;

    @Mock
    private BlockRepository blockRepository;

    @Mock
    private ReportRepository reportRepository;

    @Mock
    private MatchSuggestionRepository matchSuggestionRepository;

    @Mock
    private MongoTemplate mongoTemplate;

    @Mock
    private NotificationService notificationService;

    private DiscoveryService discoveryService;

    @BeforeEach
    void setUp() {
        discoveryService = new DiscoveryService(
                userRepository,
                connectionRepository,
                blockRepository,
                reportRepository,
                matchSuggestionRepository,
                mongoTemplate,
                notificationService);
    }

    @Test
    void acceptConnection_upgradesPendingToMatched() {
        User me = user("me-id", "clerk-me");
        User target = user("target-id", "clerk-target");

        Connection pending = Connection.builder()
                .senderId(target.getId())
                .receiverId(me.getId())
                .status(ConnectionStatus.pending)
                .interactionType(InteractionType.match_invite)
                .build();

        when(userRepository.findByClerkId("clerk-me")).thenReturn(Optional.of(me));
        when(userRepository.findById("target-id")).thenReturn(Optional.of(target));
        when(connectionRepository.findBySenderIdInAndReceiverIdIn(
                List.of("me-id", "target-id"),
                List.of("me-id", "target-id")))
                .thenReturn(List.of(pending));

        discoveryService.acceptConnection("clerk-me", "target-id");

        ArgumentCaptor<Connection> captor = ArgumentCaptor.forClass(Connection.class);
        verify(connectionRepository).save(captor.capture());
        assertEquals(ConnectionStatus.matched, captor.getValue().getStatus());
        verify(notificationService).createMatchNotification("me-id", "target-id");
        verify(notificationService).createMatchNotification("target-id", "me-id");
    }

    @Test
    void acceptConnection_keepsMatchedStatusUnchanged() {
        User me = user("me-id", "clerk-me");
        User target = user("target-id", "clerk-target");

        Connection matched = Connection.builder()
                .senderId(target.getId())
                .receiverId(me.getId())
                .status(ConnectionStatus.matched)
                .interactionType(InteractionType.match_invite)
                .build();

        when(userRepository.findByClerkId("clerk-me")).thenReturn(Optional.of(me));
        when(userRepository.findById("target-id")).thenReturn(Optional.of(target));
        when(connectionRepository.findBySenderIdInAndReceiverIdIn(
                List.of("me-id", "target-id"),
                List.of("me-id", "target-id")))
                .thenReturn(List.of(matched));

        discoveryService.acceptConnection("clerk-me", "target-id");

        ArgumentCaptor<Connection> captor = ArgumentCaptor.forClass(Connection.class);
        verify(connectionRepository).save(captor.capture());
        assertEquals(ConnectionStatus.matched, captor.getValue().getStatus());
        verify(notificationService, times(0)).createMatchNotification("me-id", "target-id");
        verify(notificationService, times(0)).createMatchNotification("target-id", "me-id");
    }

    @Test
    void acceptConnection_createsNewConnectionWhenMissing() {
        User me = user("me-id", "clerk-me");
        User target = user("target-id", "clerk-target");

        when(userRepository.findByClerkId("clerk-me")).thenReturn(Optional.of(me));
        when(userRepository.findById("target-id")).thenReturn(Optional.of(target));
        when(connectionRepository.findBySenderIdInAndReceiverIdIn(
                List.of("me-id", "target-id"),
                List.of("me-id", "target-id")))
                .thenReturn(List.of());

        discoveryService.acceptConnection("clerk-me", "target-id");

        ArgumentCaptor<Connection> captor = ArgumentCaptor.forClass(Connection.class);
        verify(connectionRepository).save(captor.capture());
        Connection saved = captor.getValue();
        assertEquals(ConnectionStatus.matched, saved.getStatus());
        assertEquals("target-id", saved.getSenderId());
        assertEquals("me-id", saved.getReceiverId());
        assertEquals(InteractionType.match_invite, saved.getInteractionType());
        verify(notificationService).createMatchNotification("me-id", "target-id");
        verify(notificationService).createMatchNotification("target-id", "me-id");
    }

    @Test
    void acceptConnection_rejectsSelfAccept() {
        User me = user("me-id", "clerk-me");

        when(userRepository.findByClerkId("clerk-me")).thenReturn(Optional.of(me));
        when(userRepository.findById("me-id")).thenReturn(Optional.of(me));

        assertThrows(IllegalArgumentException.class, () -> discoveryService.acceptConnection("clerk-me", "me-id"));
    }

    @Test
    void recordInteraction_likeCreatesLikedConnectionAndLikeNotification() {
        User me = user("me-id", "clerk-me");
        User target = user("target-id", "clerk-target");

        when(userRepository.findByClerkId("clerk-me")).thenReturn(Optional.of(me));
        when(userRepository.findById("target-id")).thenReturn(Optional.of(target));
        when(connectionRepository.findBySenderIdInAndReceiverIdIn(
                List.of("me-id", "target-id"),
                List.of("me-id", "target-id")))
                .thenReturn(List.of());

        RecordInteractionRequest request = new RecordInteractionRequest();
        request.setClerkId("clerk-me");
        request.setTargetUserId("target-id");
        request.setActionType(RecentActionType.like);
        request.setInteractionType(InteractionType.match_invite);

        discoveryService.recordInteraction(request);

        ArgumentCaptor<Connection> captor = ArgumentCaptor.forClass(Connection.class);
        verify(connectionRepository).save(captor.capture());
        assertEquals(ConnectionStatus.liked, captor.getValue().getStatus());
        verify(notificationService).createConnectionLikedNotification("target-id", "me-id");
    }

    private User user(String id, String clerkId) {
        return User.builder()
                .id(id)
                .clerkId(clerkId)
                .username(id)
                .email(id + "@example.com")
                .build();
    }
}
