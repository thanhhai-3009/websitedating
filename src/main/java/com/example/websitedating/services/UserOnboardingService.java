package com.example.websitedating.services;

import com.example.websitedating.dto.UserResponse;
import com.example.websitedating.dto.UserProfileResponse;
import com.example.websitedating.models.User;
import com.example.websitedating.repository.UserRepository;
import com.example.websitedating.dto.OnboardingRequest;
import java.time.Instant;
import java.time.LocalDate;
import java.time.Period;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.data.mongodb.core.geo.GeoJsonPoint;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

@Service
public class UserOnboardingService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public UserOnboardingService(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    public UserResponse save(OnboardingRequest request) {
        String clerkId = normalizeNullable(request.getClerkId());
        String email = normalize(request.getEmail());
        if (clerkId == null) {
            throw new IllegalArgumentException("Clerk ID is required");
        }
        if (email.isBlank()) {
            throw new IllegalArgumentException("Email is required");
        }

        User user = userRepository.findByClerkId(clerkId)
                .or(() -> userRepository.findByEmailIgnoreCase(email))
                .map(existing -> ensureClerkLinked(existing, clerkId))
                .orElseGet(() -> createFromOnboarding(request, clerkId, email));

        applyOnboardingData(user, request);
        user.setIsVerified(true);
        user.setStatus(ensureStatus(user.getStatus()));
        user.getStatus().setLastSeen(Instant.now());

        User saved = userRepository.save(user);
        return UserResponse.from(saved);
    }

    public UserProfileResponse getProfileByClerkId(String clerkId) {
        String normalizedClerkId = normalizeNullable(clerkId);
        if (normalizedClerkId == null) {
            throw new IllegalArgumentException("Clerk ID is required");
        }

        User user = userRepository.findByClerkId(normalizedClerkId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User profile not found"));

        return UserProfileResponse.from(user);
    }

    private User ensureClerkLinked(User user, String clerkId) {
        if (user.getClerkId() != null && !user.getClerkId().equals(clerkId)) {
            throw new IllegalArgumentException("Email is already linked to another Clerk account");
        }
        user.setClerkId(clerkId);
        return user;
    }

    private User createFromOnboarding(OnboardingRequest request, String clerkId, String email) {
        String fullName = fullName(request.getFirstName(), request.getLastName());
        String preferred = fullName.isBlank() ? email : fullName;
        String username = ensureUniqueUsername(preferred, email);

        return User.builder()
                .clerkId(clerkId)
                .email(email)
                .username(username)
                .passwordHash(passwordEncoder.encode(UUID.randomUUID().toString()))
                .isVerified(true)
                .profile(defaultProfile())
                .preferences(defaultPreferences())
                .behaviorSignals(defaultBehaviorSignals())
                .settings(User.Settings.builder().build())
                .status(User.Status.builder().build())
                .build();
    }

    private void applyOnboardingData(User user, OnboardingRequest request) {
        User.Profile profile = ensureProfile(user.getProfile());
        User.PersonalInfo personalInfo = ensurePersonalInfo(profile.getPersonalInfo());
        User.Preferences preferences = ensurePreferences(user.getPreferences());

        String fullName = fullName(request.getFirstName(), request.getLastName());
        if (!fullName.isBlank()) {
            personalInfo.setName(fullName);
        }

        LocalDate birthday = parseBirthday(request.getBirthday());
        if (birthday != null) {
            personalInfo.setBirthday(birthday);
            personalInfo.setAge(Math.max(0, Period.between(birthday, LocalDate.now()).getYears()));
        }

        String gender = normalizeNullable(request.getGender());
        if (gender != null) {
            personalInfo.setGender(gender);
        }

        String location = normalizeNullable(request.getLocation());
        if (location != null) {
            personalInfo.setLocationText(location);
            personalInfo.setRegion(location);
        }

        applyCoordinates(personalInfo, request.getLongitude(), request.getLatitude());

        String imageUrl = normalizeNullable(request.getImageUrl());
        if (imageUrl != null) {
            profile.setAvatarUrl(imageUrl);
        }

        if (request.getPhotos() != null) {
            List<String> photos = request.getPhotos().stream()
                    .filter(value -> value != null && !value.isBlank())
                    .map(String::trim)
                    .distinct()
                    .limit(6)
                    .collect(Collectors.toList());
            profile.setPhotos(photos);
            if (!photos.isEmpty()) {
                profile.setAvatarUrl(photos.get(0));
            }
        }

        String bio = normalizeNullable(request.getBio());
        if (bio != null) {
            profile.setBio(bio);
        }

        if (request.getInterests() != null && !request.getInterests().isEmpty()) {
            profile.setInterests(request.getInterests().stream()
                    .filter(value -> value != null && !value.isBlank())
                    .map(String::trim)
                    .distinct()
                    .collect(Collectors.toList()));
        }

        String lookingFor = normalizeNullable(request.getLookingFor());
        if (lookingFor != null) {
            preferences.setPreferredGenders(mapPreferredGenders(lookingFor));
        }

        profile.setPersonalInfo(personalInfo);
        user.setProfile(profile);
        user.setPreferences(preferences);
        user.setBehaviorSignals(ensureBehaviorSignals(user.getBehaviorSignals()));
        user.setSettings(ensureSettings(user.getSettings()));
    }

    private List<String> mapPreferredGenders(String lookingFor) {
        String normalized = lookingFor.toLowerCase(Locale.ROOT);
        if ("men".equals(normalized) || "man".equals(normalized)) {
            return List.of("man");
        }
        if ("women".equals(normalized) || "woman".equals(normalized)) {
            return List.of("woman");
        }
        return Arrays.asList("man", "woman", "other");
    }

    private String fullName(String firstName, String lastName) {
        String first = normalizeNullable(firstName);
        String last = normalizeNullable(lastName);
        if (first == null && last == null) {
            return "";
        }
        if (first == null) {
            return last;
        }
        if (last == null) {
            return first;
        }
        return first + " " + last;
    }

    private LocalDate parseBirthday(String value) {
        String trimmed = normalizeNullable(value);
        if (trimmed == null) {
            return null;
        }
        try {
            return LocalDate.parse(trimmed);
        } catch (DateTimeParseException ex) {
            throw new IllegalArgumentException("Birthday must be in yyyy-MM-dd format");
        }
    }

    private User.Profile ensureProfile(User.Profile profile) {
        if (profile != null) {
            return profile;
        }
        return defaultProfile();
    }

    private User.PersonalInfo ensurePersonalInfo(User.PersonalInfo personalInfo) {
        if (personalInfo != null) {
            return personalInfo;
        }
        return User.PersonalInfo.builder().build();
    }

    private User.Preferences ensurePreferences(User.Preferences preferences) {
        if (preferences != null) {
            return preferences;
        }
        return defaultPreferences();
    }

    private User.Settings ensureSettings(User.Settings settings) {
        if (settings != null) {
            return settings;
        }
        return User.Settings.builder().build();
    }

    private User.Status ensureStatus(User.Status status) {
        if (status != null) {
            return status;
        }
        return User.Status.builder().build();
    }

    private User.BehaviorSignals ensureBehaviorSignals(User.BehaviorSignals behaviorSignals) {
        if (behaviorSignals != null) {
            return behaviorSignals;
        }
        return defaultBehaviorSignals();
    }

    private User.Profile defaultProfile() {
        return User.Profile.builder()
                .avatarUrl("")
                .bio("")
            .photos(new ArrayList<>())
                .personalInfo(User.PersonalInfo.builder().build())
                .interests(new ArrayList<>())
                .build();
    }

    private User.Preferences defaultPreferences() {
        return User.Preferences.builder()
                .ageRange(User.IntRange.builder().min(18).max(99).build())
                .preferredGenders(new ArrayList<>())
                .preferredRegions(new ArrayList<>())
                .maxDistanceKm(30)
                .preferredInterests(new ArrayList<>())
                .budgetRange(User.IntRange.builder().min(0).max(0).build())
                .build();
    }

    private User.BehaviorSignals defaultBehaviorSignals() {
        return User.BehaviorSignals.builder()
                .likesGiven(0)
                .likesReceived(0)
                .profileViews(0)
                .activeHours(new ArrayList<>())
                .recentActions(new ArrayList<>())
                .build();
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    private String normalizeNullable(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private void validateCoordinates(Double longitude, Double latitude) {
        if (longitude == null || latitude == null) {
            throw new IllegalArgumentException("Longitude and latitude are required");
        }
        if (longitude < -180d || longitude > 180d) {
            throw new IllegalArgumentException("Longitude must be between -180 and 180");
        }
        if (latitude < -90d || latitude > 90d) {
            throw new IllegalArgumentException("Latitude must be between -90 and 90");
        }
    }

    private void applyCoordinates(User.PersonalInfo personalInfo, Double longitude, Double latitude) {
        if (longitude == null && latitude == null) {
            if (personalInfo.getLocation() == null) {
                throw new IllegalArgumentException("Longitude and latitude are required");
            }
            return;
        }
        if (longitude == null || latitude == null) {
            throw new IllegalArgumentException("Longitude and latitude are required together");
        }
        validateCoordinates(longitude, latitude);
        personalInfo.setLocation(new GeoJsonPoint(longitude, latitude));
    }

    private String ensureUniqueUsername(String preferredUsername, String email) {
        String base = preferredUsername == null ? "" : preferredUsername.toLowerCase(Locale.ROOT);
        base = base.replaceAll("[^a-z0-9._-]", "");
        if (base.length() < 3) {
            int atIndex = email.indexOf('@');
            base = atIndex > 0 ? email.substring(0, atIndex) : "user";
            base = base.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9._-]", "");
        }
        if (base.length() < 3) {
            base = "user";
        }
        if (base.length() > 30) {
            base = base.substring(0, 30);
        }

        String candidate = base;
        int suffix = 1;
        while (userRepository.existsByUsernameIgnoreCase(candidate)) {
            candidate = base + suffix;
            suffix++;
        }
        return candidate;
    }
}
