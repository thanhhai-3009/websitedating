package com.example.websitedating.repository;

import com.example.websitedating.models.Connection;
import java.util.Collection;
import java.util.List;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface ConnectionRepository extends MongoRepository<Connection, String> {

    List<Connection> findBySenderIdOrReceiverId(String senderId, String receiverId);

    List<Connection> findBySenderIdInAndReceiverIdIn(Collection<String> senderIds, Collection<String> receiverIds);
}

