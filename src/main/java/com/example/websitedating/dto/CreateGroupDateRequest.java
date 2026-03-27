package com.example.websitedating.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateGroupDateRequest {

    @NotBlank(message = "title is required")
    private String title;

    private List<String> tags;

    @NotNull(message = "maxMembers is required")
    @Min(value = 1, message = "maxMembers must be at least 1")
    private Integer maxMembers;

    private List<Long> memberIds;

    @NotNull(message = "eventDate is required")
    private Instant eventDate;
}
