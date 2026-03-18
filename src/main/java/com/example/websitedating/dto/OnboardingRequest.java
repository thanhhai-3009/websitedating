package com.example.websitedating.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;

public class OnboardingRequest {

    @NotBlank(message = "Clerk ID is required")
    @Size(max = 100, message = "Clerk ID is too long")
    private String clerkId;

    @Email(message = "Email is invalid")
    @NotBlank(message = "Email is required")
    private String email;

    @Size(max = 120, message = "First name is too long")
    private String firstName;

    @Size(max = 120, message = "Last name is too long")
    private String lastName;

    @Size(max = 1000, message = "Image URL is too long")
    private String imageUrl;

    // ISO date from browser date input (yyyy-MM-dd)
    private String birthday;

    @Size(max = 32, message = "Gender is too long")
    private String gender;

    @Size(max = 32, message = "Looking for is too long")
    private String lookingFor;

    @Size(max = 255, message = "Location is too long")
    private String location;

    private List<String> interests;

    @Size(max = 500, message = "Bio is too long")
    private String bio;

    public String getClerkId() {
        return clerkId;
    }

    public void setClerkId(String clerkId) {
        this.clerkId = clerkId;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getFirstName() {
        return firstName;
    }

    public void setFirstName(String firstName) {
        this.firstName = firstName;
    }

    public String getLastName() {
        return lastName;
    }

    public void setLastName(String lastName) {
        this.lastName = lastName;
    }

    public String getImageUrl() {
        return imageUrl;
    }

    public void setImageUrl(String imageUrl) {
        this.imageUrl = imageUrl;
    }

    public String getBirthday() {
        return birthday;
    }

    public void setBirthday(String birthday) {
        this.birthday = birthday;
    }

    public String getGender() {
        return gender;
    }

    public void setGender(String gender) {
        this.gender = gender;
    }

    public String getLookingFor() {
        return lookingFor;
    }

    public void setLookingFor(String lookingFor) {
        this.lookingFor = lookingFor;
    }

    public String getLocation() {
        return location;
    }

    public void setLocation(String location) {
        this.location = location;
    }

    public List<String> getInterests() {
        return interests;
    }

    public void setInterests(List<String> interests) {
        this.interests = interests;
    }

    public String getBio() {
        return bio;
    }

    public void setBio(String bio) {
        this.bio = bio;
    }
}
