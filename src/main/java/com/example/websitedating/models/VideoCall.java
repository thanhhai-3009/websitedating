package com.example.websitedating.models;

import com.example.websitedating.constants.CommonEnums.VideoCallStatus;
import lombok.*;
import org.springframework.data.annotation.*;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document("video_calls")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@CompoundIndex(name = "caller_receiver_createdAt_idx", def = "{'callerId':1,'receiverId':1,'createdAt':-1}")
public class VideoCall {
    @Id
    private String id;
    private String chatId;
    private String callerId;
    private String receiverId;
    @Builder.Default
    private VideoCallStatus status = VideoCallStatus.ringing;
    private Instant startedAt;
    private Instant endedAt;
    @Builder.Default
    private Integer durationSeconds = 0;
    private String signalingChannel;

    @CreatedDate
    private Instant createdAt;
    @LastModifiedDate
    private Instant updatedAt;
}
