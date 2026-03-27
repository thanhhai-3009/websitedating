package com.example.websitedating.services;

import com.example.websitedating.dto.CreateGroupDateRequest;
import com.example.websitedating.dto.GroupSearchResponse;
import com.example.websitedating.models.GroupDate;
import com.example.websitedating.models.User;
import com.example.websitedating.repository.GroupDateRepository;
import com.example.websitedating.repository.UserRepository;
import org.bson.Document;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.BasicQuery;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class GroupDateService {

    private final GroupDateRepository groupDateRepository;
    private final UserRepository userRepository;
    private final MongoTemplate mongoTemplate;

    public GroupDateService(
            GroupDateRepository groupDateRepository,
            UserRepository userRepository,
            MongoTemplate mongoTemplate
    ) {
        this.groupDateRepository = groupDateRepository;
        this.userRepository = userRepository;
        this.mongoTemplate = mongoTemplate;
    }

    public GroupDate createGroup(String principal, CreateGroupDateRequest request) {
        User user = resolveAuthenticatedUser(principal);
        if (!Boolean.TRUE.equals(user.getIsVerified())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only verified users can create groups");
        }

        List<Long> initialMembers = sanitizeMemberIds(request.getMemberIds());
        if (initialMembers.size() > request.getMaxMembers()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "members size cannot exceed maxMembers");
        }

        GroupDate.GroupStatus status = initialMembers.size() >= request.getMaxMembers()
                ? GroupDate.GroupStatus.FULL
                : GroupDate.GroupStatus.OPEN;

        GroupDate groupDate = GroupDate.builder()
                .title(request.getTitle().trim())
                .tags(sanitizeTags(request.getTags()))
                .maxMembers(request.getMaxMembers())
                .memberIds(initialMembers)
                .eventDate(request.getEventDate())
                .status(status)
                .build();

        return groupDateRepository.save(groupDate);
    }

    @Transactional
    public GroupDate joinGroup(String groupId, Long memberId) {
        if (memberId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "memberId is required");
        }

        Map<String, Object> filter = Map.of(
                "_id", groupId,
                "status", GroupDate.GroupStatus.OPEN.name(),
                "memberIds", Map.of("$ne", memberId),
                "$expr", Map.of("$lt", List.of(Map.of("$size", "$memberIds"), "$maxMembers"))
        );

        Query query = new BasicQuery(new Document(filter));
        Update update = new Update().push("memberIds", memberId);
        FindAndModifyOptions options = FindAndModifyOptions.options().returnNew(true);

        GroupDate updated = mongoTemplate.findAndModify(query, update, options, GroupDate.class);
        if (updated != null) {
            if (updated.getMemberIds().size() >= updated.getMaxMembers()
                    && updated.getStatus() != GroupDate.GroupStatus.FULL) {
                updated.setStatus(GroupDate.GroupStatus.FULL);
                updated = groupDateRepository.save(updated);
            }
            return updated;
        }

        GroupDate existing = groupDateRepository.findById(groupId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Group not found"));

        if (existing.getStatus() != GroupDate.GroupStatus.OPEN) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Group is not open");
        }
        if (existing.getMemberIds() != null && existing.getMemberIds().contains(memberId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "User is already a member of this group");
        }
        if (existing.getMemberIds() != null && existing.getMemberIds().size() >= existing.getMaxMembers()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Group is full");
        }

        throw new ResponseStatusException(HttpStatus.CONFLICT, "Could not join group due to concurrent update. Please retry");
    }

    public List<GroupSearchResponse> searchGroups(List<String> interests) {
        Instant now = Instant.now();
        List<String> normalizedInterests = sanitizeTags(interests).stream()
                .map(value -> value.toLowerCase(Locale.ROOT))
                .toList();

        List<GroupDate> groups = normalizedInterests.isEmpty()
                ? groupDateRepository.findUpcomingGroups(now)
                : groupDateRepository.findUpcomingGroupsByAnyTag(now, normalizedInterests);

        return groups.stream()
                .map(group -> {
                    List<String> tags = group.getTags() == null ? List.of() : group.getTags();
                    List<String> matchTags = tags.stream()
                            .filter(Objects::nonNull)
                            .filter(tag -> normalizedInterests.contains(tag.toLowerCase(Locale.ROOT)))
                            .distinct()
                            .toList();

                    return GroupSearchResponse.builder()
                            .group(group)
                            .matchTags(matchTags)
                            .matchCount(matchTags.size())
                            .build();
                })
                .sorted(Comparator
                        .comparing(GroupSearchResponse::getMatchCount, Comparator.reverseOrder())
                        .thenComparing(value -> value.getGroup().getEventDate(), Comparator.nullsLast(Comparator.naturalOrder())))
                .collect(Collectors.toList());
    }

    private User resolveAuthenticatedUser(String principal) {
        if (principal == null || principal.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing authentication principal");
        }

        Optional<User> byClerkId = userRepository.findByClerkId(principal);
        if (byClerkId.isPresent()) {
            return byClerkId.get();
        }

        return userRepository.findByEmailIgnoreCase(principal)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authenticated user not found"));
    }

    private List<String> sanitizeTags(List<String> tags) {
        if (tags == null || tags.isEmpty()) {
            return new ArrayList<>();
        }
        Set<String> distinctTags = new LinkedHashSet<>();
        for (String value : tags) {
            if (value == null) {
                continue;
            }
            String normalized = value.trim();
            if (!normalized.isBlank()) {
                distinctTags.add(normalized);
            }
        }
        return new ArrayList<>(distinctTags);
    }

    private List<Long> sanitizeMemberIds(List<Long> memberIds) {
        if (memberIds == null || memberIds.isEmpty()) {
            return new ArrayList<>();
        }
        return memberIds.stream()
                .filter(Objects::nonNull)
                .distinct()
                .collect(Collectors.toCollection(ArrayList::new));
    }
}
