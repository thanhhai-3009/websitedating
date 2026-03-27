package com.example.websitedating.controllers;

import com.example.websitedating.dto.CreateGroupDateRequest;
import com.example.websitedating.dto.GroupSearchResponse;
import com.example.websitedating.dto.JoinGroupRequest;
import com.example.websitedating.models.GroupDate;
import com.example.websitedating.services.GroupDateService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/groups")
public class GroupDateController {

    private final GroupDateService groupDateService;

    public GroupDateController(GroupDateService groupDateService) {
        this.groupDateService = groupDateService;
    }

    @PostMapping
    public ResponseEntity<GroupDate> createGroup(
            @Valid @RequestBody CreateGroupDateRequest request,
            Authentication authentication
    ) {
        String principal = requirePrincipal(authentication);
        GroupDate created = groupDateService.createGroup(principal, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PostMapping("/{id}/join")
    public ResponseEntity<Map<String, Object>> joinGroup(
            @PathVariable String id,
            @Valid @RequestBody JoinGroupRequest request
    ) {
        GroupDate group = groupDateService.joinGroup(id, request.getMemberId());
        return ResponseEntity.ok(Map.of("success", true, "group", group));
    }

    @GetMapping("/search")
    public List<GroupSearchResponse> searchGroups(
            @RequestParam(name = "interests", required = false) String interests
    ) {
        List<String> parsedInterests = interests == null || interests.isBlank()
                ? List.of()
                : List.of(interests.split(","));
        return groupDateService.searchGroups(parsedInterests);
    }

    private String requirePrincipal(Authentication authentication) {
        if (authentication == null || authentication.getName() == null || authentication.getName().isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing authentication principal");
        }
        return authentication.getName();
    }
}
