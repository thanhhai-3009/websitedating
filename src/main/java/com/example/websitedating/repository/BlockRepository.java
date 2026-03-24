package com.example.websitedating.repository;

import com.example.websitedating.models.Block;
import java.time.Instant;
import java.util.List;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface BlockRepository extends MongoRepository<Block, String> {

    List<Block> findByBlockerIdOrBlockedUserId(String blockerId, String blockedUserId);

    long countByBlockedUserIdAndCreatedAtAfter(String blockedUserId, Instant since);
}

