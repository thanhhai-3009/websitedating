package com.example.websitedating.repository;

import com.example.websitedating.models.PaymentTransaction;
import java.util.Optional;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface PaymentTransactionRepository extends MongoRepository<PaymentTransaction, String> {
    Optional<PaymentTransaction> findByOrderId(String orderId);

    Optional<PaymentTransaction> findByRequestId(String requestId);
}

