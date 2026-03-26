package com.example.websitedating.configs;

import java.util.Arrays;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

import com.example.websitedating.websocket.DirectSignalingSocketHandler;

@Configuration
@EnableWebSocket
public class DirectSignalingWebSocketConfig implements WebSocketConfigurer {

    private final DirectSignalingSocketHandler directSignalingSocketHandler;
    private final String[] allowedOrigins;

    public DirectSignalingWebSocketConfig(
            DirectSignalingSocketHandler directSignalingSocketHandler,
            @Value("${app.cors.allowed-origins:http://localhost:5173,https://*.trycloudflare.com}") String allowedOrigins) {
        this.directSignalingSocketHandler = directSignalingSocketHandler;
        this.allowedOrigins = Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(value -> !value.isBlank())
                .toArray(String[]::new);
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        // Dung endpoint rieng de khong xung dot voi STOMP SockJS /ws hien tai.
        registry.addHandler(directSignalingSocketHandler, "/ws-signal")
                    .setAllowedOriginPatterns(allowedOrigins);
    }
}
