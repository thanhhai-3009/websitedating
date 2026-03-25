package com.example.websitedating.repository;

import com.example.websitedating.models.Block;
import java.util.List;
import java.util.Optional;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface BlockRepository extends MongoRepository<Block, String> {

    List<Block> findByBlockerIdOrBlockedUserId(String blockerId, String blockedUserId);

    List<Block> findByBlockerId(String blockerId);

    Optional<Block> findByBlockerIdAndBlockedUserId(String blockerId, String blockedUserId);

    boolean existsByBlockerIdAndBlockedUserId(String blockerId, String blockedUserId);

    void deleteByBlockerIdAndBlockedUserId(String blockerId, String blockedUserId);
}
