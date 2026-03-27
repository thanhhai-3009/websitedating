package com.example.websitedating.repository;

import com.example.websitedating.models.GroupDate;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface GroupDateRepository extends MongoRepository<GroupDate, String> {

    @Query("{ 'eventDate': { '$gt': ?0 } }")
    List<GroupDate> findUpcomingGroups(Instant now);

    @Query("{ 'eventDate': { '$gt': ?0 }, 'tags': { '$in': ?1 } }")
    List<GroupDate> findUpcomingGroupsByAnyTag(Instant now, List<String> tags);
}
