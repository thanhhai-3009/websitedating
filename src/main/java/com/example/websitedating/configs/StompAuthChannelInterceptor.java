package com.example.websitedating.configs;

import com.example.websitedating.security.ClerkJwtVerifier;
import com.example.websitedating.services.WebSocketPresenceService;
import java.security.Principal;
import java.util.List;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Component;

@Component
public class StompAuthChannelInterceptor implements ChannelInterceptor {

    private final ClerkJwtVerifier clerkJwtVerifier;
    private final WebSocketPresenceService webSocketPresenceService;

    public StompAuthChannelInterceptor(
            ClerkJwtVerifier clerkJwtVerifier,
            WebSocketPresenceService webSocketPresenceService) {
        this.clerkJwtVerifier = clerkJwtVerifier;
        this.webSocketPresenceService = webSocketPresenceService;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null || accessor.getCommand() == null) {
            return message;
        }

        if (StompCommand.CONNECT.equals(accessor.getCommand())) {
            String token = resolveBearerToken(accessor);
            ClerkJwtVerifier.ClerkPrincipal principal = clerkJwtVerifier.verify(token)
                    .orElseThrow(() -> new IllegalArgumentException("Unauthorized websocket connection"));

            Principal authentication = new UsernamePasswordAuthenticationToken(
                    principal.clerkId(),
                    null,
                    List.of());
            accessor.setUser(authentication);

            if (accessor.getSessionId() != null) {
                webSocketPresenceService.registerSession(accessor.getSessionId(), principal.clerkId());
            }
            return message;
        }

        if (StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
            String roomId = extractRoomId(accessor.getDestination());
            String sessionId = accessor.getSessionId();
            String subscriptionId = accessor.getSubscriptionId();
            if (roomId != null && sessionId != null && subscriptionId != null) {
                webSocketPresenceService.registerRoomSubscription(sessionId, subscriptionId, roomId);
            }
            return message;
        }

        if (StompCommand.UNSUBSCRIBE.equals(accessor.getCommand())) {
            String sessionId = accessor.getSessionId();
            String subscriptionId = accessor.getSubscriptionId();
            if (sessionId != null && subscriptionId != null) {
                webSocketPresenceService.unregisterSubscription(sessionId, subscriptionId);
            }
            return message;
        }

        if (StompCommand.DISCONNECT.equals(accessor.getCommand())) {
            String sessionId = accessor.getSessionId();
            if (sessionId != null) {
                webSocketPresenceService.unregisterSession(sessionId);
            }
        }

        return message;
    }

    private String extractRoomId(String destination) {
        if (destination == null) {
            return null;
        }
        String prefix = "/topic/room/";
        if (!destination.startsWith(prefix)) {
            return null;
        }
        String roomId = destination.substring(prefix.length()).trim();
        return roomId.isBlank() ? null : roomId;
    }

    private String resolveBearerToken(StompHeaderAccessor accessor) {
        List<String> headers = accessor.getNativeHeader("Authorization");
        if (headers == null || headers.isEmpty()) {
            return null;
        }

        String raw = headers.get(0);
        if (raw == null) {
            return null;
        }

        String trimmed = raw.trim();
        if (trimmed.regionMatches(true, 0, "Bearer ", 0, 7)) {
            return trimmed.substring(7).trim();
        }
        return trimmed;
    }
}