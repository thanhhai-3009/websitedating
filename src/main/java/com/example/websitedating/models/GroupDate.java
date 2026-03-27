package com.example.websitedating.models;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Document("group_dates")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@CompoundIndexes({
        @CompoundIndex(name = "group_event_status_idx", def = "{'eventDate':1,'status':1}"),
        @CompoundIndex(name = "group_tags_idx", def = "{'tags':1}")
})
public class GroupDate {
    @Id
    private String id;

    private String title;

    @Builder.Default
    private List<String> tags = new ArrayList<>();

    private Integer maxMembers;

    @Builder.Default
    private List<Long> memberIds = new ArrayList<>();

    @Builder.Default
    private GroupStatus status = GroupStatus.OPEN;

    private Instant eventDate;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;

    public enum GroupStatus {
        OPEN,
        FULL
    }
}
