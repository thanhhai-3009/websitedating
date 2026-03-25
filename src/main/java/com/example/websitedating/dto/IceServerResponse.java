package com.example.websitedating.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record IceServerResponse(
        String urls,
        String username,
        String credential) {
}
