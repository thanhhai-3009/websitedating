package com.example.websitedating.configs;

import com.example.websitedating.websocket.WebRtcSignalingHandler;
import com.example.websitedating.websocket.WebSocketHandshakeInterceptor;
import java.util.Arrays;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer, WebSocketConfigurer {

    private final StompAuthChannelInterceptor stompAuthChannelInterceptor;
    private final WebRtcSignalingHandler webRtcSignalingHandler;
    private final WebSocketHandshakeInterceptor webSocketHandshakeInterceptor;
    private final String[] allowedOrigins;

    public WebSocketConfig(
            StompAuthChannelInterceptor stompAuthChannelInterceptor,
            WebRtcSignalingHandler webRtcSignalingHandler,
            WebSocketHandshakeInterceptor webSocketHandshakeInterceptor,
            @Value("${app.cors.allowed-origins:http://localhost:5173,https://*.trycloudflare.com}") String allowedOrigins) {
        this.stompAuthChannelInterceptor = stompAuthChannelInterceptor;
        this.webRtcSignalingHandler = webRtcSignalingHandler;
        this.webSocketHandshakeInterceptor = webSocketHandshakeInterceptor;
        this.allowedOrigins = Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(value -> !value.isBlank())
                .toArray(String[]::new);
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // STOMP endpoint cho chat (SockJS fallback)
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns(allowedOrigins)
                .withSockJS()
                .setSessionCookieNeeded(false);
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        // Raw WebSocket endpoint cho WebRTC signaling (khong dung STOMP)
        registry.addHandler(webRtcSignalingHandler, "/ws-signal")
                .setAllowedOriginPatterns(allowedOrigins)
                .addInterceptors(webSocketHandshakeInterceptor);
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic", "/queue");
        registry.setApplicationDestinationPrefixes("/app");
        registry.setUserDestinationPrefix("/user");
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(stompAuthChannelInterceptor);
    }
}
