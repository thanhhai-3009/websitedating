package com.example.websitedating.security;

import com.example.websitedating.models.User;
import com.example.websitedating.repository.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Locale;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final ClerkJwtVerifier clerkJwtVerifier;
    private final UserRepository userRepository;

    public JwtAuthenticationFilter(
            JwtService jwtService,
            ClerkJwtVerifier clerkJwtVerifier,
            UserRepository userRepository) {
        this.jwtService = jwtService;
        this.clerkJwtVerifier = clerkJwtVerifier;
        this.userRepository = userRepository;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            response.setStatus(HttpServletResponse.SC_OK);
            return;
        }

        String authHeader = request.getHeader("Authorization");

        // ─── CLERK-ID PARAM FALLBACK ──────────────────────────────────────────
        // Many endpoints are permitAll() but use clerkId in params.
        String clerkIdParam = request.getParameter("clerkId");
        if (clerkIdParam != null && !clerkIdParam.isBlank()) {
            Optional<User> u = userRepository.findByClerkId(clerkIdParam);
            if (u.isPresent() && isBanned(u.get(), response)) return;
        }

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        String token = authHeader.substring(7);
        try {
            // Re-check authentication context — if something else (like another filter)
            // already set it, we still want to verify the user isn't banned.
            Object existingAuth = SecurityContextHolder.getContext().getAuthentication();
            if (existingAuth != null && existingAuth instanceof UsernamePasswordAuthenticationToken auth) {
                String principal = auth.getName();
                userRepository.findByClerkId(principal)
                        .or(() -> userRepository.findByEmailIgnoreCase(principal))
                        .ifPresent(u -> {
                            try {
                                if (isBanned(u, response)) return;
                            } catch (IOException ignored) {}
                        });
                // If we didn't return (not banned), let the chain continue
                if (response.isCommitted()) return;
            }

            // Normal Authentication logic
            Optional<User> appUser = tryGetAppUser(token);
            if (appUser.isPresent()) {
                if (isBanned(appUser.get(), response)) return;
                setAuthentication(appUser.get().getEmail(), appUser.get().getRole(), request);
                filterChain.doFilter(request, response);
                return;
            }

            Optional<User> clerkUser = tryGetClerkUser(token);
            if (clerkUser.isPresent()) {
                if (isBanned(clerkUser.get(), response)) return;
                
                String principalName = clerkUser.get().getClerkId() != null && !clerkUser.get().getClerkId().isBlank()
                        ? clerkUser.get().getClerkId()
                        : clerkUser.get().getEmail();
                setAuthentication(principalName, clerkUser.get().getRole(), request);
            }
        } catch (Exception ignored) {
            SecurityContextHolder.clearContext();
        }

        filterChain.doFilter(request, response);
    }

    private boolean isBanned(User user, HttpServletResponse response) throws IOException {
        if (Boolean.TRUE.equals(user.getIsBanned())) {
            Instant banExpiresAt = user.getBanExpiresAt();
            if (banExpiresAt != null && !banExpiresAt.isAfter(Instant.now())) {
                // Timed ban elapsed: unlock user automatically on next authenticated request.
                user.setIsBanned(false);
                user.setBanReason(null);
                user.setBannedAt(null);
                user.setBanExpiresAt(null);
                user.setBanDurationHours(null);
                userRepository.save(user);
                return false;
            }

            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
            response.setContentType("application/json");
            String reason = user.getBanReason() != null ? user.getBanReason() : "Violation of community guidelines";
            response.getWriter().write("{\"message\": \"Account banned: " + reason + "\", \"banned\": true}");
            return true;
        }
        return false;
    }

    private Optional<User> tryGetAppUser(String token) {
        try {
            String email = jwtService.extractSubject(token);
            if (email == null || email.isBlank()) {
                return Optional.empty();
            }

            Optional<User> userOpt = userRepository.findByEmailIgnoreCase(email);
            if (userOpt.isPresent() && jwtService.isTokenValid(token, userOpt.get().getEmail())) {
                return userOpt;
            }
        } catch (Exception ignored) {
            return Optional.empty();
        }
        return Optional.empty();
    }

    private Optional<User> tryGetClerkUser(String token) {
        Optional<ClerkJwtVerifier.ClerkPrincipal> principalOpt = clerkJwtVerifier.verify(token);
        if (principalOpt.isEmpty()) {
            return Optional.empty();
        }

        ClerkJwtVerifier.ClerkPrincipal principal = principalOpt.get();

        Optional<User> userOpt = userRepository.findByClerkId(principal.clerkId());
        if (userOpt.isEmpty() && principal.email() != null) {
            userOpt = userRepository.findByEmailIgnoreCase(principal.email().toLowerCase(Locale.ROOT));
        }
        return userOpt;
    }

    private void setAuthentication(String principalName, String role, HttpServletRequest request) {
        String authority = role != null && role.startsWith("ROLE_") ? role : "ROLE_" + (role != null ? role.toUpperCase(Locale.ROOT) : "USER");
        UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                principalName,
                null,
                List.of(new SimpleGrantedAuthority(authority)));
        authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
        SecurityContextHolder.getContext().setAuthentication(authentication);
    }
}
