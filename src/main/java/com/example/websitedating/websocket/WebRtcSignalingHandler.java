package com.example.websitedating.websocket;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

/**
 * WebRTC Signaling Handler - Manages P2P signaling for Video/Audio calls
 * Relays OFFER, ANSWER, ICE_CANDIDATE, and LEAVE messages between peers
 */
@Component
public class WebRtcSignalingHandler extends TextWebSocketHandler {

    private static final Logger logger = LoggerFactory.getLogger(WebRtcSignalingHandler.class);
    private static final ObjectMapper objectMapper = new ObjectMapper();

    // Map Clerk User ID -> WebSocket Session
    private final ConcurrentHashMap<String, WebSocketSession> userSessions = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String clerkId = (String) session.getAttributes().get("clerkId");
        if (clerkId == null || clerkId.isBlank()) {
            logger.warn("WebRTC signaling rejected: missing clerkId on session {}", session.getId());
            session.close(CloseStatus.NOT_ACCEPTABLE.withReason("Unauthorized"));
            return;
        }

        userSessions.put(clerkId, session);
        logger.info("WebRTC signaling connection established: {} ({})", clerkId, session.getId());
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        try {
            String payload = message.getPayload();
            Map<String, Object> signalingData = objectMapper.readValue(payload, Map.class);

            String senderId = (String) session.getAttributes().get("clerkId");
            String roomId = (String) signalingData.get("roomId");
            String type = (String) signalingData.get("type");
            String targetId = (String) signalingData.get("targetId");
            String data = (String) signalingData.get("data");

            if (senderId == null) {
                logger.warn("Signaling message received from unauthenticated session");
                session.close(CloseStatus.NOT_ACCEPTABLE.withReason("Unauthorized"));
                return;
            }

            if (!"OFFER".equals(type) && !"ANSWER".equals(type)
                    && !"ICE_CANDIDATE".equals(type) && !"LEAVE".equals(type)) {
                logger.warn("Invalid signaling type: {}", type);
                return;
            }

            userSessions.put(senderId, session);

            if (targetId != null && !targetId.isEmpty()) {
                WebSocketSession targetSession = userSessions.get(targetId);
                if (targetSession != null && targetSession.isOpen()) {
                    String responsePayload = objectMapper.writeValueAsString(Map.of(
                        "type", type,
                        "senderId", senderId,
                        "targetId", targetId,
                        "roomId", roomId,
                        "data", data
                    ));
                    targetSession.sendMessage(new TextMessage(responsePayload));
                    logger.debug("Relayed {} from {} to {}", type, senderId, targetId);
                } else {
                    logger.warn("Target user {} not connected", targetId);
                }
            }

            if ("LEAVE".equals(type)) {
                logger.info("User {} left call with {}", senderId, targetId);
            }

        } catch (Exception e) {
            logger.error("Error handling signaling message", e);
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        String clerkId = (String) session.getAttributes().get("clerkId");
        if (clerkId != null) {
            userSessions.remove(clerkId);
            logger.info("WebRTC signaling connection closed: {} - User: {}", session.getId(), clerkId);
        }
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
        logger.error("WebRTC signaling transport error: {}", session.getId(), exception);
    }
}

