package com.example.websitedating.websocket;

import com.example.websitedating.security.ClerkJwtVerifier;
import com.example.websitedating.security.ClerkJwtVerifier.ClerkPrincipal;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

/**
 * Handshake Interceptor for WebSocket - Extracts JWT token and Clerk ID
 */
@Component
public class WebSocketHandshakeInterceptor implements HandshakeInterceptor {

    private static final Logger logger = LoggerFactory.getLogger(WebSocketHandshakeInterceptor.class);
    private final ClerkJwtVerifier clerkJwtVerifier;

    public WebSocketHandshakeInterceptor(ClerkJwtVerifier clerkJwtVerifier) {
        this.clerkJwtVerifier = clerkJwtVerifier;
    }

    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
            WebSocketHandler wsHandler, Map<String, Object> attributes) throws Exception {

        try {
            // Extract token from query parameter (e.g., ?token=<JWT>)
            String query = request.getURI().getQuery();
            String token = null;

            if (query != null) {
                String[] params = query.split("&");
                for (String param : params) {
                    if (param.startsWith("token=")) {
                        token = param.substring(6);
                        token = java.net.URLDecoder.decode(token, "UTF-8");
                        break;
                    }
                }
            }

            if (token != null) {
                // Validate Clerk JWT and extract Clerk ID
                Optional<ClerkPrincipal> principal = clerkJwtVerifier.verify(token);
                if (principal.isPresent()) {
                    String clerkId = principal.get().clerkId();
                    attributes.put("clerkId", clerkId);
                    logger.debug("WebSocket handshake: Authenticated user {}", clerkId);
                    return true;
                }
            }

            logger.warn("WebSocket handshake failed: Invalid or missing Clerk token");
            return false;

        } catch (Exception e) {
            logger.error("Error during WebSocket handshake", e);
            return false;
        }
    }

    @Override
    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response,
            WebSocketHandler wsHandler, Exception exception) {
        if (exception != null) {
            logger.error("Error after WebSocket handshake", exception);
        }
    }
}

