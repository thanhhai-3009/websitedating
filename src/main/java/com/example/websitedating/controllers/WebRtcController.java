package com.example.websitedating.controllers;

import com.example.websitedating.dto.IceServerResponse;
import java.util.ArrayList;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/webrtc")
public class WebRTCController {

    @Value("${app.webrtc.stun-urls:stun:stun.l.google.com:19302}")
    private String stunUrls;

    @Value("${app.webrtc.turn-url:}")
    private String turnUrl;

    @Value("${app.webrtc.turn-username:}")
    private String turnUsername;

    @Value("${app.webrtc.turn-credential:}")
    private String turnCredential;

    @GetMapping("/ice-servers")
    public List<IceServerResponse> iceServers() {
        List<IceServerResponse> iceServers = new ArrayList<>();

        if (stunUrls != null && !stunUrls.isBlank()) {
            for (String value : stunUrls.split(",")) {
                String trimmed = value.trim();
                if (!trimmed.isEmpty()) {
                    iceServers.add(new IceServerResponse(trimmed, null, null));
                }
            }
        }

        if (turnUrl != null && !turnUrl.isBlank()) {
            iceServers.add(new IceServerResponse(
                    turnUrl.trim(),
                    emptyToNull(turnUsername),
                    emptyToNull(turnCredential)));
        }

        if (iceServers.isEmpty()) {
            iceServers.add(new IceServerResponse("stun:stun.l.google.com:19302", null, null));
        }

        return iceServers;
    }

    private String emptyToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }
}
