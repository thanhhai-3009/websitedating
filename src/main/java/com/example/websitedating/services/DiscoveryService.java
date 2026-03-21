package com.example.websitedating.services;

import com.example.websitedating.constants.CommonEnums.ConnectionStatus;
import com.example.websitedating.constants.CommonEnums.InteractionType;
import com.example.websitedating.constants.CommonEnums.MatchedBy;
import com.example.websitedating.constants.CommonEnums.ReasonTag;
import com.example.websitedating.constants.CommonEnums.RecentActionType;
import com.example.websitedating.dto.DiscoverUserResponse;
import com.example.websitedating.dto.MatchResponse;
import com.example.websitedating.dto.RecordInteractionRequest;
import com.example.websitedating.models.Block;
import com.example.websitedating.models.Connection;
import com.example.websitedating.models.MatchSuggestion;
import com.example.websitedating.models.Report;
import com.example.websitedating.models.User;
import com.example.websitedating.repository.BlockRepository;
import com.example.websitedating.repository.ConnectionRepository;
import com.example.websitedating.repository.MatchSuggestionRepository;
import com.example.websitedating.repository.ReportRepository;
import com.example.websitedating.repository.UserRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.data.geo.Point;
import org.springframework.data.mongodb.core.geo.GeoJsonPoint;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

@Service
public class DiscoveryService {

    private static final double EARTH_RADIUS_KM = 6371.0088d;

    private final UserRepository userRepository;
    private final ConnectionRepository connectionRepository;
    private final BlockRepository blockRepository;
    private final ReportRepository reportRepository;
    private final MatchSuggestionRepository matchSuggestionRepository;
    private final MongoTemplate mongoTemplate;
    private final NotificationService notificationService;

    public DiscoveryService(
            UserRepository userRepository,
            ConnectionRepository connectionRepository,
            BlockRepository blockRepository,
            ReportRepository reportRepository,
            MatchSuggestionRepository matchSuggestionRepository,
            MongoTemplate mongoTemplate,
            NotificationService notificationService) {
        this.userRepository = userRepository;
        this.connectionRepository = connectionRepository;
        this.blockRepository = blockRepository;
        this.reportRepository = reportRepository;
        this.matchSuggestionRepository = matchSuggestionRepository;
        this.mongoTemplate = mongoTemplate;
        this.notificationService = notificationService;
    }

    public List<DiscoverUserResponse> nearby(String clerkId, Double longitude, Double latitude, Integer radiusKm, Integer limit) {
        User me = findByClerkId(clerkId);
        GeoJsonPoint center = resolveCenter(me, longitude, latitude);
        int effectiveRadiusKm = radiusKm == null || radiusKm <= 0 ? defaultRadius(me) : Math.min(radiusKm, 500);
        int effectiveLimit = limit == null || limit <= 0 ? 20 : Math.min(limit, 100);
        Set<String> excludedIds = excludedUserIds(me.getId());

        return nearbyCandidates(center, effectiveRadiusKm, effectiveLimit).stream()
                .filter(candidate -> !candidate.getId().equals(me.getId()))
                .filter(candidate -> !excludedIds.contains(candidate.getId()))
                .filter(candidate -> allowGeoDiscovery(candidate.getSettings()))
                .filter(candidate -> matchesPreference(me, candidate) && matchesPreference(candidate, me))
                .map(candidate -> toResponse(me, candidate, null))
                .sorted(Comparator.comparing(DiscoverUserResponse::getDistanceKm, Comparator.nullsLast(Double::compareTo)))
                .limit(effectiveLimit)
                .toList();
    }

    public List<DiscoverUserResponse> recommendations(String clerkId, Integer limit) {
        User me = findByClerkId(clerkId);
        int effectiveLimit = limit == null || limit <= 0 ? 20 : Math.min(limit, 100);

        List<User> candidates = baseCandidates(me, effectiveLimit * 8);
        List<ScoredCandidate> scored = candidates.stream()
                .map(candidate -> score(me, candidate))
                .sorted(Comparator.comparing(ScoredCandidate::score).reversed())
                .limit(effectiveLimit)
                .toList();

        matchSuggestionRepository.deleteByUserId(me.getId());
        List<MatchSuggestion> snapshots = scored.stream()
                .map(value -> MatchSuggestion.builder()
                        .userId(me.getId())
                        .candidateUserId(value.user().getId())
                        .score(value.score())
                        .reasonTags(value.reasonTags())
                        .generatedAt(Instant.now())
                        .build())
                .toList();
        if (!snapshots.isEmpty()) {
            matchSuggestionRepository.saveAll(snapshots);
        }

        return scored.stream()
                .map(value -> toResponse(me, value.user(), value))
                .toList();
    }

    public List<MatchResponse> matches(String clerkId, Integer limit) {
        User me = findByClerkId(clerkId);
        int effectiveLimit = limit == null || limit <= 0 ? 50 : Math.min(limit, 100);

        List<Connection> orderedConnections = connectionRepository.findBySenderIdOrReceiverId(me.getId(), me.getId()).stream()
                .filter(connection -> connection.getStatus() == ConnectionStatus.matched
                        || connection.getStatus() == ConnectionStatus.accepted)
                .sorted(Comparator.comparing(this::connectionTimestamp, Comparator.nullsLast(Comparator.naturalOrder())).reversed())
                .toList();

        LinkedHashMap<String, Instant> counterpartMatchedAt = new LinkedHashMap<>();
        for (Connection connection : orderedConnections) {
            String counterpartId = me.getId().equals(connection.getSenderId())
                    ? connection.getReceiverId()
                    : connection.getSenderId();
            if (counterpartId != null && !counterpartId.isBlank()) {
                counterpartMatchedAt.putIfAbsent(counterpartId, connectionTimestamp(connection));
            }
        }

        if (counterpartMatchedAt.isEmpty()) {
            return List.of();
        }

        Set<String> excludedIds = blockedOrReportedUserIds(me.getId());
        Map<String, User> userById = userRepository.findAllById(counterpartMatchedAt.keySet()).stream()
                .collect(Collectors.toMap(User::getId, value -> value));

        return counterpartMatchedAt.entrySet().stream()
                .filter(entry -> !excludedIds.contains(entry.getKey()))
                .map(entry -> {
                    User candidate = userById.get(entry.getKey());
                    if (candidate == null) {
                        return null;
                    }
                    return MatchResponse.from(candidate, entry.getValue());
                })
                .filter(value -> value != null)
                .limit(effectiveLimit)
                .toList();
    }

    public void recordInteraction(RecordInteractionRequest request) {
        User me = findByClerkId(request.getClerkId());
        User target = userRepository.findById(request.getTargetUserId())
                .orElseThrow(() -> new IllegalArgumentException("Target user not found"));

        if (me.getId().equals(target.getId())) {
            throw new IllegalArgumentException("Cannot interact with yourself");
        }

        User.BehaviorSignals mySignals = ensureBehaviorSignals(me.getBehaviorSignals());
        User.BehaviorSignals targetSignals = ensureBehaviorSignals(target.getBehaviorSignals());

        mySignals.setRecentActions(pushAction(mySignals.getRecentActions(), request.getActionType(), target.getId()));
        mySignals.setActiveHours(pushActiveHour(mySignals.getActiveHours(), Instant.now()));
        if (request.getActionType() == RecentActionType.like) {
            mySignals.setLikesGiven(defaultZero(mySignals.getLikesGiven()) + 1);
            targetSignals.setLikesReceived(defaultZero(targetSignals.getLikesReceived()) + 1);
        }
        if (request.getActionType() == RecentActionType.view) {
            targetSignals.setProfileViews(defaultZero(targetSignals.getProfileViews()) + 1);
        }

        me.setBehaviorSignals(mySignals);
        target.setBehaviorSignals(targetSignals);

        userRepository.save(me);
        userRepository.save(target);

        if (request.getInteractionType() != null || request.getActionType() == RecentActionType.like) {
            InteractionType interactionType = request.getInteractionType() == null
                    ? InteractionType.like
                    : request.getInteractionType();

            saveConnection(me.getId(), target.getId(), interactionType);
        }
    }

    private void saveConnection(String senderId, String receiverId, InteractionType interactionType) {
        InteractionType effectiveInteraction = interactionType == null ? InteractionType.like : interactionType;
        ConnectionStatus desiredStatus = ConnectionStatus.matched;

        List<Connection> existing = connectionRepository.findBySenderIdInAndReceiverIdIn(
                Arrays.asList(senderId, receiverId),
                Arrays.asList(senderId, receiverId));

        if (!existing.isEmpty()) {
            Connection first = existing.get(0);
            boolean changed = false;

            if (first.getStatus() != ConnectionStatus.matched && first.getStatus() != ConnectionStatus.accepted) {
                first.setStatus(desiredStatus);
                changed = true;
                
                if (desiredStatus == ConnectionStatus.matched || desiredStatus == ConnectionStatus.accepted) {
                    notificationService.createMatchNotification(first.getSenderId(), first.getReceiverId());
                    notificationService.createMatchNotification(first.getReceiverId(), first.getSenderId());
                }
            }
            if (effectiveInteraction == InteractionType.match_invite
                    && first.getInteractionType() != InteractionType.match_invite) {
                first.setInteractionType(InteractionType.match_invite);
                changed = true;
            }

            if (changed) {
                connectionRepository.save(first);
            }
            return;
        }

        Connection connection = Connection.builder()
                .senderId(senderId)
                .receiverId(receiverId)
                .interactionType(effectiveInteraction)
                .status(desiredStatus)
                .matchedBy(effectiveInteraction == InteractionType.match_invite ? MatchedBy.manual : MatchedBy.behavior)
                .build();
        connectionRepository.save(connection);

        if (desiredStatus == ConnectionStatus.matched || desiredStatus == ConnectionStatus.accepted) {
            notificationService.createMatchNotification(senderId, receiverId);
            notificationService.createMatchNotification(receiverId, senderId);
        }
    }

    private List<User> baseCandidates(User me, int maxCandidates) {
        GeoJsonPoint myLocation = extractPoint(me);
        Set<String> excludedIds = excludedUserIds(me.getId());

        List<User> byGeo;
        if (myLocation != null) {
            byGeo = nearbyCandidates(myLocation, Math.max(defaultRadius(me), 120), Math.min(maxCandidates * 2, 500));
        } else {
            byGeo = userRepository.findAll();
        }

        return byGeo.stream()
                .filter(candidate -> !candidate.getId().equals(me.getId()))
                .filter(candidate -> !excludedIds.contains(candidate.getId()))
                .filter(candidate -> allowGeoDiscovery(candidate.getSettings()))
                .filter(candidate -> matchesPreference(me, candidate) && matchesPreference(candidate, me))
                .limit(maxCandidates)
                .toList();
    }

    private ScoredCandidate score(User me, User candidate) {
        double interestScore = interestScore(me, candidate);
        double behaviorScore = behaviorScore(me, candidate);
        double preferenceScore = preferenceFitScore(me, candidate);
        double distanceScore = distanceScore(me, candidate);

        double finalScore = clamp(
                (interestScore * 0.35d)
                        + (behaviorScore * 0.25d)
                        + (preferenceScore * 0.25d)
                        + (distanceScore * 0.15d));

        List<ReasonTag> reasonTags = new ArrayList<>();
        if (interestScore >= 0.4d) {
            reasonTags.add(ReasonTag.same_interest);
        }
        if (distanceScore >= 0.6d) {
            reasonTags.add(ReasonTag.nearby);
        }
        if (behaviorScore >= 0.4d) {
            reasonTags.add(ReasonTag.similar_behavior);
        }
        if (reasonTags.isEmpty()) {
            reasonTags.add(ReasonTag.profile_similarity);
        }

        return new ScoredCandidate(candidate, round(finalScore), reasonTags);
    }

    private double interestScore(User me, User candidate) {
        Set<String> my = normalizeSet(me.getProfile() == null ? List.of() : me.getProfile().getInterests());
        Set<String> other = normalizeSet(candidate.getProfile() == null ? List.of() : candidate.getProfile().getInterests());
        if (my.isEmpty() || other.isEmpty()) {
            return 0d;
        }
        Set<String> intersection = new HashSet<>(my);
        intersection.retainAll(other);
        Set<String> union = new HashSet<>(my);
        union.addAll(other);
        return union.isEmpty() ? 0d : (double) intersection.size() / (double) union.size();
    }

    private double behaviorScore(User me, User candidate) {
        User.BehaviorSignals mySignals = ensureBehaviorSignals(me.getBehaviorSignals());
        User.BehaviorSignals otherSignals = ensureBehaviorSignals(candidate.getBehaviorSignals());

        double hourOverlap = overlapRatio(mySignals.getActiveHours(), otherSignals.getActiveHours());
        double actionOverlap = overlapRatio(
                mySignals.getRecentActions().stream().map(action -> action.getActionType().name()).toList(),
                otherSignals.getRecentActions().stream().map(action -> action.getActionType().name()).toList());

        double myLikeRatio = likeRatio(mySignals);
        double otherLikeRatio = likeRatio(otherSignals);
        double engagementSimilarity = 1d - Math.min(1d, Math.abs(myLikeRatio - otherLikeRatio));

        return clamp((hourOverlap * 0.4d) + (actionOverlap * 0.3d) + (engagementSimilarity * 0.3d));
    }

    private double preferenceFitScore(User me, User candidate) {
        return matchesPreference(me, candidate) && matchesPreference(candidate, me) ? 1d : 0.2d;
    }

    private double distanceScore(User me, User candidate) {
        Double distance = distanceKm(me, candidate);
        if (distance == null) {
            return 0.4d;
        }
        int preferredDistance = defaultRadius(me);
        double normalized = 1d - Math.min(1d, distance / Math.max(1d, preferredDistance));
        return clamp(normalized);
    }

    private DiscoverUserResponse toResponse(User me, User candidate, ScoredCandidate scoredCandidate) {
        DiscoverUserResponse response = new DiscoverUserResponse();
        response.setUserId(candidate.getId());
        response.setUsername(candidate.getUsername());

        User.PersonalInfo personalInfo = candidate.getProfile() == null ? null : candidate.getProfile().getPersonalInfo();
        response.setDisplayName(personalInfo != null && personalInfo.getName() != null && !personalInfo.getName().isBlank()
                ? personalInfo.getName()
                : candidate.getUsername());
        response.setAge(personalInfo == null ? null : personalInfo.getAge());
        response.setGender(personalInfo == null ? null : personalInfo.getGender());
        response.setLocation(personalInfo == null ? null : personalInfo.getLocationText());
        response.setAvatarUrl(candidate.getProfile() == null ? "" : safe(candidate.getProfile().getAvatarUrl()));
        response.setBio(candidate.getProfile() == null ? "" : safe(candidate.getProfile().getBio()));
        response.setInterests(candidate.getProfile() == null || candidate.getProfile().getInterests() == null
                ? List.of()
                : candidate.getProfile().getInterests());
        response.setVerified(Boolean.TRUE.equals(candidate.getIsVerified()));
        response.setDistanceKm(round(distanceKm(me, candidate)));

        if (scoredCandidate != null) {
            response.setScore(scoredCandidate.score());
            response.setReasonTags(scoredCandidate.reasonTags());
        }

        return response;
    }

    private boolean matchesPreference(User source, User target) {
        User.Preferences preferences = source.getPreferences();
        User.PersonalInfo targetInfo = target.getProfile() == null ? null : target.getProfile().getPersonalInfo();

        if (preferences == null || targetInfo == null) {
            return true;
        }

        Integer targetAge = targetInfo.getAge();
        if (targetAge != null && preferences.getAgeRange() != null) {
            Integer min = preferences.getAgeRange().getMin();
            Integer max = preferences.getAgeRange().getMax();
            if (min != null && targetAge < min) {
                return false;
            }
            if (max != null && targetAge > max) {
                return false;
            }
        }

        if (preferences.getPreferredGenders() != null
                && !preferences.getPreferredGenders().isEmpty()
                && targetInfo.getGender() != null
                && !preferences.getPreferredGenders().stream()
                        .map(value -> value.toLowerCase(Locale.ROOT))
                        .toList()
                        .contains(targetInfo.getGender().toLowerCase(Locale.ROOT))) {
            return false;
        }

        if (preferences.getPreferredRegions() != null
                && !preferences.getPreferredRegions().isEmpty()
                && targetInfo.getRegion() != null
                && !preferences.getPreferredRegions().stream()
                        .map(value -> value.toLowerCase(Locale.ROOT))
                        .toList()
                        .contains(targetInfo.getRegion().toLowerCase(Locale.ROOT))) {
            return false;
        }

        return true;
    }

    private Set<String> excludedUserIds(String meId) {
        Set<String> excluded = blockedOrReportedUserIds(meId);

        List<Connection> connections = connectionRepository.findBySenderIdOrReceiverId(meId, meId);
        for (Connection connection : connections) {
            if (meId.equals(connection.getSenderId())) {
                excluded.add(connection.getReceiverId());
            }
            if (meId.equals(connection.getReceiverId())) {
                excluded.add(connection.getSenderId());
            }
        }

        return excluded;
    }

    private Set<String> blockedOrReportedUserIds(String meId) {
        Set<String> excluded = new HashSet<>();

        List<Block> blocks = blockRepository.findByBlockerIdOrBlockedUserId(meId, meId);
        for (Block block : blocks) {
            if (meId.equals(block.getBlockerId())) {
                excluded.add(block.getBlockedUserId());
            }
            if (meId.equals(block.getBlockedUserId())) {
                excluded.add(block.getBlockerId());
            }
        }

        List<Report> reports = reportRepository.findByReporterIdOrReportedUserId(meId, meId);
        for (Report report : reports) {
            if (meId.equals(report.getReporterId())) {
                excluded.add(report.getReportedUserId());
            }
            if (meId.equals(report.getReportedUserId())) {
                excluded.add(report.getReporterId());
            }
        }


        return excluded;
    }

    private User findByClerkId(String clerkId) {
        if (clerkId == null || clerkId.isBlank()) {
            throw new IllegalArgumentException("Clerk ID is required");
        }
        return userRepository.findByClerkId(clerkId.trim())
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
    }

    private GeoJsonPoint resolveCenter(User me, Double longitude, Double latitude) {
        if (longitude != null && latitude != null) {
            return new GeoJsonPoint(longitude, latitude);
        }
        GeoJsonPoint fromProfile = extractPoint(me);
        if (fromProfile != null) {
            return fromProfile;
        }
        throw new IllegalArgumentException("Location is required. Update onboarding coordinates first.");
    }

    private GeoJsonPoint extractPoint(User user) {
        if (user.getProfile() == null || user.getProfile().getPersonalInfo() == null) {
            return null;
        }
        return user.getProfile().getPersonalInfo().getLocation();
    }

    private int defaultRadius(User user) {
        if (user.getPreferences() == null || user.getPreferences().getMaxDistanceKm() == null) {
            return 30;
        }
        return Math.max(1, user.getPreferences().getMaxDistanceKm());
    }

    private Instant connectionTimestamp(Connection connection) {
        if (connection.getUpdatedAt() != null) {
            return connection.getUpdatedAt();
        }
        return connection.getCreatedAt();
    }

    private boolean allowGeoDiscovery(User.Settings settings) {
        return settings == null || !Boolean.FALSE.equals(settings.getAllowGeoDiscovery());
    }

    private Double distanceKm(User from, User to) {
        GeoJsonPoint fromPoint = extractPoint(from);
        GeoJsonPoint toPoint = extractPoint(to);
        if (fromPoint == null || toPoint == null) {
            return null;
        }
        return distanceKm(fromPoint, toPoint);
    }

    private Double distanceKm(Point fromPoint, Point toPoint) {
        if (fromPoint == null || toPoint == null) {
            return null;
        }
        return haversineKm(fromPoint.getY(), fromPoint.getX(), toPoint.getY(), toPoint.getX());
    }

    private double haversineKm(double lat1, double lon1, double lat2, double lon2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2d) * Math.sin(dLat / 2d)
                + Math.cos(Math.toRadians(lat1))
                * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2d)
                * Math.sin(dLon / 2d);
        double c = 2d * Math.atan2(Math.sqrt(a), Math.sqrt(1d - a));
        return EARTH_RADIUS_KM * c;
    }

    private List<User> nearbyCandidates(Point center, int radiusKm, int limit) {
        try {
            Query query = new Query();
            query.addCriteria(
                    Criteria.where("profile.personalInfo.location")
                            .nearSphere(center)
                            .maxDistance(radiusKm * 1000d));
            query.limit(Math.min(limit * 6, 500));
            return mongoTemplate.find(query, User.class);
        } catch (RuntimeException ex) {
            // Fallback for malformed legacy location docs or missing geospatial index.
            return userRepository.findAll().stream()
                    .filter(candidate -> distanceKm(center, extractPoint(candidate)) != null)
                    .filter(candidate -> {
                        Double km = distanceKm(center, extractPoint(candidate));
                        return km != null && km <= radiusKm;
                    })
                    .sorted(Comparator.comparing(candidate -> distanceKm(center, extractPoint(candidate))))
                    .limit(Math.min(limit * 6L, 500L))
                    .toList();
        }
    }

    private Set<String> normalizeSet(List<String> rawValues) {
        if (rawValues == null || rawValues.isEmpty()) {
            return Set.of();
        }
        return rawValues.stream()
                .filter(value -> value != null && !value.isBlank())
                .map(value -> value.trim().toLowerCase(Locale.ROOT))
                .collect(Collectors.toSet());
    }

    private double overlapRatio(List<?> first, List<?> second) {
        Set<String> left = normalizeSet(first == null ? List.of() : first.stream().map(String::valueOf).toList());
        Set<String> right = normalizeSet(second == null ? List.of() : second.stream().map(String::valueOf).toList());
        if (left.isEmpty() || right.isEmpty()) {
            return 0d;
        }
        Set<String> intersection = new HashSet<>(left);
        intersection.retainAll(right);
        Set<String> union = new HashSet<>(left);
        union.addAll(right);
        return union.isEmpty() ? 0d : (double) intersection.size() / (double) union.size();
    }

    private double likeRatio(User.BehaviorSignals signals) {
        int likesGiven = defaultZero(signals.getLikesGiven());
        int views = Math.max(1, defaultZero(signals.getProfileViews()));
        return Math.min(1d, (double) likesGiven / (double) views);
    }

    private User.BehaviorSignals ensureBehaviorSignals(User.BehaviorSignals behaviorSignals) {
        if (behaviorSignals != null) {
            if (behaviorSignals.getActiveHours() == null) {
                behaviorSignals.setActiveHours(new ArrayList<>());
            }
            if (behaviorSignals.getRecentActions() == null) {
                behaviorSignals.setRecentActions(new ArrayList<>());
            }
            return behaviorSignals;
        }

        return User.BehaviorSignals.builder()
                .likesGiven(0)
                .likesReceived(0)
                .profileViews(0)
                .activeHours(new ArrayList<>())
                .recentActions(new ArrayList<>())
                .build();
    }

    private List<User.RecentAction> pushAction(List<User.RecentAction> existing, RecentActionType actionType, String targetUserId) {
        List<User.RecentAction> actions = existing == null ? new ArrayList<>() : new ArrayList<>(existing);
        actions.add(User.RecentAction.builder()
                .actionType(actionType)
                .targetUserId(targetUserId)
                .createdAt(Instant.now())
                .build());
        int maxRecentActions = 60;
        if (actions.size() > maxRecentActions) {
            return actions.subList(actions.size() - maxRecentActions, actions.size());
        }
        return actions;
    }

    private List<Integer> pushActiveHour(List<Integer> existing, Instant instant) {
        List<Integer> hours = existing == null ? new ArrayList<>() : new ArrayList<>(existing);
        int hour = instant.atZone(java.time.ZoneOffset.UTC).getHour();
        hours.add(hour);
        int maxHours = 120;
        if (hours.size() > maxHours) {
            return hours.subList(hours.size() - maxHours, hours.size());
        }
        return hours;
    }

    private int defaultZero(Integer value) {
        return value == null ? 0 : value;
    }

    private double clamp(double value) {
        return Math.max(0d, Math.min(1d, value));
    }

    private Double round(Double value) {
        if (value == null) {
            return null;
        }
        return Math.round(value * 100d) / 100d;
    }

    private String safe(String value) {
        return value == null ? "" : value;
    }

    private record ScoredCandidate(User user, Double score, List<ReasonTag> reasonTags) {}
}


