package com.example.websitedating.security;

import com.example.websitedating.models.User;
import com.example.websitedating.repository.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
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
        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        String token = authHeader.substring(7);
        try {
            if (SecurityContextHolder.getContext().getAuthentication() != null) {
                filterChain.doFilter(request, response);
                return;
            }

            if (tryAuthenticateWithAppJwt(token, request)) {
                filterChain.doFilter(request, response);
                return;
            }

            tryAuthenticateWithClerkJwt(token, request);
        } catch (Exception ignored) {
            SecurityContextHolder.clearContext();
        }

        filterChain.doFilter(request, response);
    }

    private boolean tryAuthenticateWithAppJwt(String token, HttpServletRequest request) {
        try {
            String email = jwtService.extractSubject(token);
            if (email == null || email.isBlank()) {
                return false;
            }

            Optional<User> userOpt = userRepository.findByEmailIgnoreCase(email);
            if (userOpt.isPresent() && jwtService.isTokenValid(token, userOpt.get().getEmail())) {
                setAuthentication(userOpt.get().getEmail(), request);
                return true;
            }
        } catch (Exception ignored) {
            return false;
        }
        return false;
    }

    private void tryAuthenticateWithClerkJwt(String token, HttpServletRequest request) {
        Optional<ClerkJwtVerifier.ClerkPrincipal> principalOpt = clerkJwtVerifier.verify(token);
        if (principalOpt.isEmpty()) {
            return;
        }

        ClerkJwtVerifier.ClerkPrincipal principal = principalOpt.get();

        Optional<User> userOpt = userRepository.findByClerkId(principal.clerkId());
        if (userOpt.isEmpty() && principal.email() != null) {
            userOpt = userRepository.findByEmailIgnoreCase(principal.email().toLowerCase(Locale.ROOT));
        }
        if (userOpt.isEmpty()) {
            return;
        }

        String principalName = userOpt.get().getClerkId() != null && !userOpt.get().getClerkId().isBlank()
                ? userOpt.get().getClerkId()
                : userOpt.get().getEmail();
        setAuthentication(principalName, request);
    }

    private void setAuthentication(String principalName, HttpServletRequest request) {
        UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                principalName,
                null,
                List.of(new SimpleGrantedAuthority("ROLE_USER")));
        authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
        SecurityContextHolder.getContext().setAuthentication(authentication);
    }
}
