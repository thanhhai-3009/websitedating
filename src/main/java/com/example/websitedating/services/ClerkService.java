package com.example.websitedating.services;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

@Service
public class ClerkService {

    private final String clerkSecretKey;
    private final RestTemplate restTemplate;

    public ClerkService(@Value("${app.clerk.secret-key}") String clerkSecretKey) {
        this.clerkSecretKey = clerkSecretKey;
        this.restTemplate = new RestTemplate();
    }

    public void deleteUser(String clerkId) {
        if (clerkId == null || clerkId.isBlank()) {
            return; 
        }
        if (clerkSecretKey == null || clerkSecretKey.isBlank()) {
            System.err.println("Cannot delete user on Clerk: No secret key configured");
            return;
        }
        try {
            String url = "https://api.clerk.com/v1/users/" + clerkId;
            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", "Bearer " + clerkSecretKey);
            HttpEntity<String> entity = new HttpEntity<>(headers);
            restTemplate.exchange(url, HttpMethod.DELETE, entity, Void.class);
        } catch (Exception e) {
            System.err.println("Failed to delete user on Clerk: " + e.getMessage());
        }
    }
}
