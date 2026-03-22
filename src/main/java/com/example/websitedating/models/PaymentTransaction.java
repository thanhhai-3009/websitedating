package com.example.websitedating.models;

import java.time.Instant;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Document("payment_transactions")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PaymentTransaction {
    @Id
    private String id;

    @Indexed(unique = true)
    private String orderId;

    @Indexed(unique = true)
    private String requestId;

    @Indexed
    private String userId;

    private String clerkId;
    private String planId;
    private Long amount;
    private String currency;
    private String status;
    private String payUrl;
    private String transId;
    private Integer resultCode;
    private String message;
    private String rawPayload;
    private Instant paidAt;
    private Instant createdAt;
    private Instant updatedAt;
}

