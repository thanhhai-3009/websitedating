package com.example.websitedating.repository;

import com.example.websitedating.models.Notification;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface NotificationRepository extends MongoRepository<Notification, String> {
    List<Notification> findByUserIdAndIsReadFalseOrderByCreatedAtDesc(String userId);
    List<Notification> findByUserIdOrderByCreatedAtDesc(String userId);
}
