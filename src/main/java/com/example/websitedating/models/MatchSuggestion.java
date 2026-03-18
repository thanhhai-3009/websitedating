package com.example.websitedating.models;

import com.example.websitedating.constants.CommonEnums.ReasonTag;
import lombok.*;
import org.springframework.data.annotation.*;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;
import java.util.List;

@Document("match_suggestions")
@Data @Builder @NoArgsConstructor @AllArgsConstructor
@CompoundIndex(name = "user_score_generatedAt_idx", def = "{'userId':1,'score':-1,'generatedAt':-1}")
public class MatchSuggestion {
    @Id private String id;
    private String userId;
    private String candidateUserId;
    private Double score; // 0..1
    private List<ReasonTag> reasonTags;
    @Builder.Default private Instant generatedAt = Instant.now();
    @CreatedDate private Instant createdAt;
    @LastModifiedDate private Instant updatedAt;
}
