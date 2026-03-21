package com.example.websitedating.security;

import java.util.Collection;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.stereotype.Component;

@Component
public class ClerkJwtVerifier {

    private static final Logger log = LoggerFactory.getLogger(ClerkJwtVerifier.class);

    private final JwtDecoder jwtDecoder;
    private final boolean enabled;

    public ClerkJwtVerifier(
            @Value("${app.clerk.jwt.issuer:}") String issuer,
            @Value("${app.clerk.jwt.jwks-uri:}") String jwksUri,
            @Value("${app.clerk.jwt.audience:}") String audience) {
        String normalizedIssuer = trimToNull(issuer);
        String normalizedJwksUri = trimToNull(jwksUri);
        String normalizedAudience = trimToNull(audience);

        if (normalizedIssuer == null && normalizedJwksUri == null) {
            this.jwtDecoder = null;
            this.enabled = false;
            log.warn("Clerk JWT verifier is disabled: missing app.clerk.jwt.issuer or app.clerk.jwt.jwks-uri");
            return;
        }

        String resolvedJwksUri = normalizedJwksUri != null ? normalizedJwksUri : normalizeIssuer(normalizedIssuer) + "/.well-known/jwks.json";
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri(resolvedJwksUri).build();

        OAuth2TokenValidator<Jwt> validator = normalizedIssuer != null
                ? JwtValidators.createDefaultWithIssuer(normalizedIssuer)
                : JwtValidators.createDefault();

        if (normalizedAudience != null) {
            OAuth2TokenValidator<Jwt> audienceValidator = jwt -> {
                Collection<String> tokenAudience = jwt.getAudience();
                if (tokenAudience != null && tokenAudience.contains(normalizedAudience)) {
                    return OAuth2TokenValidatorResult.success();
                }
                return OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", "Token audience is invalid", null));
            };
            validator = new org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator<>(validator, audienceValidator);
        }

        decoder.setJwtValidator(validator);
        this.jwtDecoder = decoder;
        this.enabled = true;
        log.info("Clerk JWT verifier enabled (issuer={}, jwksUri={})", normalizedIssuer, resolvedJwksUri);
    }

    public Optional<ClerkPrincipal> verify(String token) {
        if (!enabled || token == null || token.isBlank()) {
            return Optional.empty();
        }

        try {
            Jwt jwt = jwtDecoder.decode(token);
            String clerkId = trimToNull(jwt.getSubject());
            if (clerkId == null) {
                return Optional.empty();
            }
            String email = trimToNull(jwt.getClaimAsString("email"));
            return Optional.of(new ClerkPrincipal(clerkId, email));
        } catch (JwtException ex) {
            log.debug("Clerk JWT verification failed: {}", ex.getMessage());
            return Optional.empty();
        }
    }

    public record ClerkPrincipal(String clerkId, String email) {
    }

    private String trimToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private String normalizeIssuer(String issuer) {
        if (issuer == null) {
            return null;
        }
        return issuer.endsWith("/") ? issuer.substring(0, issuer.length() - 1) : issuer;
    }
}



