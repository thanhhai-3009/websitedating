package com.example.websitedating.controllers;

import com.example.websitedating.dto.DiscoverUserResponse;
import com.example.websitedating.dto.MatchResponse;
import com.example.websitedating.dto.RecordInteractionRequest;
import com.example.websitedating.dto.AcceptConnectionRequest;
import com.example.websitedating.services.DiscoveryService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/discovery")
public class DiscoveryController {

    private final DiscoveryService discoveryService;

    public DiscoveryController(DiscoveryService discoveryService) {
        this.discoveryService = discoveryService;
    }

    @GetMapping("/nearby")
    public List<DiscoverUserResponse> nearby(
            @RequestParam String clerkId,
            @RequestParam(required = false) Double longitude,
            @RequestParam(required = false) Double latitude,
            @RequestParam(required = false) Integer radiusKm,
            @RequestParam(required = false) Integer limit) {
        return discoveryService.nearby(clerkId, longitude, latitude, radiusKm, limit);
    }

    @GetMapping("/recommendations")
    public List<DiscoverUserResponse> recommendations(
            @RequestParam String clerkId,
            @RequestParam(required = false) Integer limit) {
        return discoveryService.recommendations(clerkId, limit);
    }

    @GetMapping("/matches")
    public List<MatchResponse> matches(
            @RequestParam String clerkId,
            @RequestParam(required = false) Integer limit) {
        return discoveryService.matches(clerkId, limit);
    }

    @PostMapping("/interactions")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void recordInteraction(@Valid @RequestBody RecordInteractionRequest request) {
        discoveryService.recordInteraction(request);
    }

    @PostMapping("/connections/accept")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void acceptConnection(@Valid @RequestBody AcceptConnectionRequest request) {
        discoveryService.acceptConnection(request.getClerkId(), request.getTargetUserId());
    }
}
