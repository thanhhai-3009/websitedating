package com.example.websitedating.repository;

import com.example.websitedating.models.MatchSuggestion;
import java.util.List;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface MatchSuggestionRepository extends MongoRepository<MatchSuggestion, String> {

    List<MatchSuggestion> findTop50ByUserIdOrderByScoreDescGeneratedAtDesc(String userId);

    void deleteByUserId(String userId);
}

