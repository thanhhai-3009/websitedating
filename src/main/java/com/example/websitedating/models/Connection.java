package com.example.websitedating.models;

import com.example.websitedating.constants.CommonEnums.*;
import lombok.*;
import org.springframework.data.annotation.*;
import org.springframework.data.mongodb.core.index.*;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document("connections")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@CompoundIndexes({
        @CompoundIndex(name = "sender_receiver_unique", def = "{'senderId':1,'receiverId':1}", unique = true),
        @CompoundIndex(name = "receiver_status_createdAt_idx", def = "{'receiverId':1,'status':1,'createdAt':-1}")
})
public class Connection {
    @Id
    private String id;
    private String senderId;
    private String receiverId;
    @Builder.Default
    private InteractionType interactionType = InteractionType.like;
    @Builder.Default
    private ConnectionStatus status = ConnectionStatus.pending;
    @Builder.Default
    private MatchedBy matchedBy = MatchedBy.manual;
    private Double matchedScore;

    @CreatedDate
    private Instant createdAt;
    @LastModifiedDate
    private Instant updatedAt;
}
