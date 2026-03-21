package com.example.websitedating.dto;

import com.example.websitedating.models.User;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

public class UserProfileResponse {

    private String clerkId;
    private String email;
    private String phone;
    private String name;
    private Integer age;
    private LocalDate birthday;
    private String gender;
    private String lookingFor;
    private String location;
    private String bio;
    private String avatarUrl;
    private List<String> photos;
    private List<String> interests;
    private boolean emailVerified;
    private boolean phoneVerified;
    private boolean profileVerified;

    public static UserProfileResponse from(User user) {
        UserProfileResponse response = new UserProfileResponse();

        User.Profile profile = user.getProfile();
        User.PersonalInfo personalInfo = profile != null ? profile.getPersonalInfo() : null;

        response.clerkId = user.getClerkId();
        response.email = user.getEmail();
        response.phone = user.getPhone();
        response.name = personalInfo != null ? personalInfo.getName() : null;
        response.age = personalInfo != null ? personalInfo.getAge() : null;
        response.birthday = personalInfo != null ? personalInfo.getBirthday() : null;
        response.gender = personalInfo != null ? personalInfo.getGender() : null;
        response.location = personalInfo != null ? personalInfo.getLocationText() : null;
        response.bio = profile != null ? profile.getBio() : null;
        response.avatarUrl = profile != null ? profile.getAvatarUrl() : null;
        response.photos = profile != null && profile.getPhotos() != null
                ? profile.getPhotos()
                : new ArrayList<>();
        response.interests = profile != null && profile.getInterests() != null
                ? profile.getInterests()
                : new ArrayList<>();
        response.lookingFor = mapLookingFor(user.getPreferences());

        response.emailVerified = user.getEmail() != null && !user.getEmail().isBlank();
        response.phoneVerified = user.getPhone() != null && !user.getPhone().isBlank();
        response.profileVerified = Boolean.TRUE.equals(user.getIsVerified());

        return response;
    }

    private static String mapLookingFor(User.Preferences preferences) {
        if (preferences == null || preferences.getPreferredGenders() == null || preferences.getPreferredGenders().isEmpty()) {
            return "";
        }
        List<String> genders = preferences.getPreferredGenders().stream()
                .filter(value -> value != null && !value.isBlank())
                .map(value -> value.trim().toLowerCase())
                .distinct()
                .toList();

        if (genders.contains("man") && genders.contains("woman")) {
            return "Everyone";
        }
        if (genders.contains("man")) {
            return "Men";
        }
        if (genders.contains("woman")) {
            return "Women";
        }
        return "Everyone";
    }

    public String getClerkId() {
        return clerkId;
    }

    public String getEmail() {
        return email;
    }

    public String getPhone() {
        return phone;
    }

    public String getName() {
        return name;
    }

    public Integer getAge() {
        return age;
    }

    public LocalDate getBirthday() {
        return birthday;
    }

    public String getGender() {
        return gender;
    }

    public String getLookingFor() {
        return lookingFor;
    }

    public String getLocation() {
        return location;
    }

    public String getBio() {
        return bio;
    }

    public String getAvatarUrl() {
        return avatarUrl;
    }

    public List<String> getPhotos() {
        return photos;
    }

    public List<String> getInterests() {
        return interests;
    }

    public boolean isEmailVerified() {
        return emailVerified;
    }

    public boolean isPhoneVerified() {
        return phoneVerified;
    }

    public boolean isProfileVerified() {
        return profileVerified;
    }
}