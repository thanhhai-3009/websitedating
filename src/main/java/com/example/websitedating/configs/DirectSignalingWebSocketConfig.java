package com.example.websitedating.configs;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

import com.example.websitedating.websocket.DirectSignalingSocketHandler;

@Configuration
@EnableWebSocket
public class DirectSignalingWebSocketConfig implements WebSocketConfigurer {

    private final DirectSignalingSocketHandler directSignalingSocketHandler;

    public DirectSignalingWebSocketConfig(DirectSignalingSocketHandler directSignalingSocketHandler) {
        this.directSignalingSocketHandler = directSignalingSocketHandler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        // Dung endpoint rieng de khong xung dot voi STOMP SockJS /ws hien tai.
        registry.addHandler(directSignalingSocketHandler, "/ws-signal")
                    .setAllowedOriginPatterns("*");
    }
}
