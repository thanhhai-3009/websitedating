package com.example.websitedating.services;

import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import org.springframework.stereotype.Service;

@Service
public class WebSocketPresenceService {

    private final ConcurrentMap<String, String> sessionToUser = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, ConcurrentMap<String, String>> sessionSubscriptions = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, ConcurrentMap<String, Integer>> userRoomCounts = new ConcurrentHashMap<>();

    public void registerSession(String sessionId, String clerkId) {
        if (isBlank(sessionId) || isBlank(clerkId)) {
            return;
        }
        sessionToUser.put(sessionId, clerkId);
    }

    public void registerRoomSubscription(String sessionId, String subscriptionId, String roomId) {
        if (isBlank(sessionId) || isBlank(subscriptionId) || isBlank(roomId)) {
            return;
        }

        String clerkId = sessionToUser.get(sessionId);
        if (isBlank(clerkId)) {
            return;
        }

        String previousRoom = sessionSubscriptions
                .computeIfAbsent(sessionId, key -> new ConcurrentHashMap<>())
                .put(subscriptionId, roomId);

        if (!isBlank(previousRoom) && !Objects.equals(previousRoom, roomId)) {
            decrementRoomCount(clerkId, previousRoom);
        }
        incrementRoomCount(clerkId, roomId);
    }

    public void unregisterSubscription(String sessionId, String subscriptionId) {
        if (isBlank(sessionId) || isBlank(subscriptionId)) {
            return;
        }

        String clerkId = sessionToUser.get(sessionId);
        ConcurrentMap<String, String> subscriptions = sessionSubscriptions.get(sessionId);
        if (isBlank(clerkId) || subscriptions == null) {
            return;
        }

        String roomId = subscriptions.remove(subscriptionId);
        if (roomId != null) {
            decrementRoomCount(clerkId, roomId);
        }

        if (subscriptions.isEmpty()) {
            sessionSubscriptions.remove(sessionId);
        }
    }

    public void unregisterSession(String sessionId) {
        if (isBlank(sessionId)) {
            return;
        }

        String clerkId = sessionToUser.remove(sessionId);
        ConcurrentMap<String, String> subscriptions = sessionSubscriptions.remove(sessionId);
        if (isBlank(clerkId) || subscriptions == null) {
            return;
        }

        subscriptions.values().forEach(roomId -> decrementRoomCount(clerkId, roomId));
    }

    public boolean isUserActiveInRoom(String clerkId, String roomId) {
        if (isBlank(clerkId) || isBlank(roomId)) {
            return false;
        }
        Map<String, Integer> countsByRoom = userRoomCounts.get(clerkId);
        if (countsByRoom == null) {
            return false;
        }
        return countsByRoom.getOrDefault(roomId, 0) > 0;
    }

    private void incrementRoomCount(String clerkId, String roomId) {
        userRoomCounts
                .computeIfAbsent(clerkId, key -> new ConcurrentHashMap<>())
                .merge(roomId, 1, Integer::sum);
    }

    private void decrementRoomCount(String clerkId, String roomId) {
        userRoomCounts.computeIfPresent(clerkId, (key, countsByRoom) -> {
            countsByRoom.computeIfPresent(roomId, (r, count) -> count > 1 ? count - 1 : null);
            return countsByRoom.isEmpty() ? null : countsByRoom;
        });
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}