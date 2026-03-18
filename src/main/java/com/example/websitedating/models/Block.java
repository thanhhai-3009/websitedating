package com.example.websitedating.models;

import lombok.*;
import org.springframework.data.annotation.*;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document("blocks")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@CompoundIndex(name = "blocker_blocked_unique", def = "{'blockerId':1,'blockedUserId':1}", unique = true)
public class Block {
    @Id
    private String id;
    private String blockerId;
    private String blockedUserId;
    private String reason;
    @CreatedDate
    private Instant createdAt;
    @LastModifiedDate
    private Instant updatedAt;
}
