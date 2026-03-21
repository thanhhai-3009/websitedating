package com.example.websitedating.services;

import com.example.websitedating.dto.AuthResponse;
import com.example.websitedating.dto.LoginRequest;
import com.example.websitedating.dto.RegisterRequest;
import com.example.websitedating.dto.UserResponse;
import com.example.websitedating.security.JwtService;
import com.example.websitedating.models.User;
import com.example.websitedating.repository.UserRepository;
import java.util.Locale;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtService jwtService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    public AuthResponse register(RegisterRequest request) {
        String email = normalize(request.getEmail());
        String username = normalize(request.getUsername());
        String phone = normalizePhone(request.getPhone());
        String clerkId = normalizeNullable(request.getClerkId());

        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new IllegalArgumentException("Email already exists");
        }
        if (userRepository.existsByUsernameIgnoreCase(username)) {
            throw new IllegalArgumentException("Username already exists");
        }
        if (phone != null && userRepository.existsByPhone(phone)) {
            throw new IllegalArgumentException("Phone already exists");
        }
        if (clerkId != null && userRepository.existsByClerkId(clerkId)) {
            throw new IllegalArgumentException("Clerk ID already exists");
        }

        User user = new User();
        user.setEmail(email);
        user.setUsername(username);
        user.setPhone(phone);
        user.setClerkId(clerkId);
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
//        user.setVerified(false);
//        user.touchForCreate();
        user = userRepository.save(user);

        String token = jwtService.generateToken(user.getEmail());
        return new AuthResponse(token, UserResponse.from(user));
    }

    public AuthResponse login(LoginRequest request) {
        String identifier = normalize(request.getIdentifier());
        User user = userRepository.findByEmailIgnoreCase(identifier)
                .or(() -> userRepository.findByUsernameIgnoreCase(identifier))
                .orElseThrow(() -> new BadCredentialsException("Invalid email/username or password"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new BadCredentialsException("Invalid email/username or password");
        }

        String token = jwtService.generateToken(user.getEmail());
        return new AuthResponse(token, UserResponse.from(user));
    }

    public UserResponse getMe(String principal) {
        String normalized = normalizeNullable(principal);
        if (normalized == null) {
            throw new BadCredentialsException("User not found");
        }

        User user = userRepository.findByClerkId(normalized)
                .or(() -> userRepository.findByEmailIgnoreCase(normalized.toLowerCase(Locale.ROOT)))
                .orElseThrow(() -> new BadCredentialsException("User not found"));
        return UserResponse.from(user);
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    private String normalizePhone(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private String normalizeNullable(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }
}

