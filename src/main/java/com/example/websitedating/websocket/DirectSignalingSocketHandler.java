package com.example.websitedating.websocket;

import com.example.websitedating.dto.SignalingMessage;
import com.example.websitedating.security.ClerkJwtVerifier;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import org.springframework.web.util.UriComponentsBuilder;

@Component
public class DirectSignalingSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(DirectSignalingSocketHandler.class);

    // ClerkUserId -> session dang ket noi.
    private final ConcurrentHashMap<String, WebSocketSession> sessionsByUserId = new ConcurrentHashMap<>();
    // sessionId -> ClerkUserId de cleanup nhanh khi disconnect.
    private final ConcurrentHashMap<String, String> userIdBySessionId = new ConcurrentHashMap<>();

    private final ClerkJwtVerifier clerkJwtVerifier;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public DirectSignalingSocketHandler(ClerkJwtVerifier clerkJwtVerifier) {
        this.clerkJwtVerifier = clerkJwtVerifier;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String token = resolveToken(session.getUri());
        String clerkUserId = clerkJwtVerifier.verify(token)
                .map(ClerkJwtVerifier.ClerkPrincipal::clerkId)
                .orElse(null);

        if (clerkUserId == null || clerkUserId.isBlank()) {
            session.close(CloseStatus.NOT_ACCEPTABLE.withReason("Unauthorized websocket"));
            return;
        }

        WebSocketSession oldSession = sessionsByUserId.put(clerkUserId, session);
        if (oldSession != null && oldSession.isOpen() && !oldSession.getId().equals(session.getId())) {
            oldSession.close(CloseStatus.NORMAL.withReason("Replaced by newer session"));
        }

        userIdBySessionId.put(session.getId(), clerkUserId);
        log.info("[signal] connected user={} session={}", clerkUserId, session.getId());
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        String senderId = userIdBySessionId.get(session.getId());
        if (senderId == null) {
            closeQuietly(session, CloseStatus.NOT_ACCEPTABLE.withReason("Unauthorized sender"));
            return;
        }

        try {
            SignalingMessage incoming = objectMapper.readValue(message.getPayload(), SignalingMessage.class);
            if (incoming == null || incoming.getTargetId() == null || incoming.getTargetId().isBlank()) {
                return;
            }

            SignalingMessage.Type normalizedType = normalizeType(incoming.getType());
            if (normalizedType == null) {
                return;
            }

            SignalingMessage relayPayload = SignalingMessage.builder()
                    .roomId(incoming.getRoomId())
                    .senderId(senderId) // Luon lay sender tu JWT, khong tin du lieu client gui len.
                    .targetId(incoming.getTargetId())
                    .type(normalizedType)
                    .data(incoming.getData())
                    .build();

            WebSocketSession targetSession = sessionsByUserId.get(incoming.getTargetId());
            if (targetSession == null || !targetSession.isOpen()) {
                return;
            }

            targetSession.sendMessage(new TextMessage(objectMapper.writeValueAsString(relayPayload)));
        } catch (Exception ex) {
            log.debug("[signal] invalid message: {}", ex.getMessage());
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String userId = userIdBySessionId.remove(session.getId());
        if (userId != null) {
            sessionsByUserId.computeIfPresent(userId, (key, activeSession) ->
                    activeSession.getId().equals(session.getId()) ? null : activeSession);
        }
        log.info("[signal] disconnected session={} status={}", session.getId(), status);
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        log.debug("[signal] transport error session={} reason={}", session.getId(), exception.getMessage());
    }

    public Map<String, WebSocketSession> getSessionsByUserId() {
        return sessionsByUserId;
    }

    private SignalingMessage.Type normalizeType(SignalingMessage.Type type) {
        return type;
    }

    private String resolveToken(URI uri) {
        if (uri == null) {
            return null;
        }
        String token = UriComponentsBuilder.fromUri(uri)
                .build()
                .getQueryParams()
                .getFirst("token");
        if (token == null || token.isBlank()) {
            return null;
        }
        return java.net.URLDecoder.decode(token, StandardCharsets.UTF_8);
    }

    private void closeQuietly(WebSocketSession session, CloseStatus status) {
        try {
            if (session != null && session.isOpen()) {
                session.close(status);
            }
        } catch (IOException ignored) {
            // Ignore close error.
        }
    }
}
