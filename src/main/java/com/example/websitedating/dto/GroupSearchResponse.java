package com.example.websitedating.dto;

import com.example.websitedating.models.GroupDate;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GroupSearchResponse {
    private GroupDate group;
    private Integer matchCount;
    private List<String> matchTags;
}
