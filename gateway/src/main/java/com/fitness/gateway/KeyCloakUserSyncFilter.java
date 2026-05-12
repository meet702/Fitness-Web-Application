package com.fitness.gateway;

import com.fitness.gateway.User.UserService;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilter;
import org.springframework.web.server.WebFilterChain;
import reactor.core.publisher.Mono;

@Component
@Slf4j
@RequiredArgsConstructor
public class KeyCloakUserSyncFilter implements WebFilter {

    private final UserService userService;

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, WebFilterChain chain) {

        String path = exchange.getRequest().getPath().value();
        if (isStaticOrPublicPath(path)) {
            return chain.filter(exchange);
        }

        String userIdHeader = exchange.getRequest().getHeaders().getFirst("X-User-ID");
        String authHeader = exchange.getRequest().getHeaders().getFirst(HttpHeaders.AUTHORIZATION);

        // nothing to sync
        if (!StringUtils.hasText(authHeader) && !StringUtils.hasText(userIdHeader)) {
            return chain.filter(exchange);
        }

        // parse registerRequest safely
        RegisterRequest parsedRequest = null;
        if (StringUtils.hasText(authHeader) && authHeader.toLowerCase().startsWith("bearer")) {
            parsedRequest = safeParseRegisterRequest(authHeader);
        }

        // determine effective userId
        String extractedUserId = userIdHeader;
        if (!StringUtils.hasText(extractedUserId) &&
                parsedRequest != null &&
                StringUtils.hasText(parsedRequest.getKeyCloakId())) {
            extractedUserId = parsedRequest.getKeyCloakId();
        }

        if (!StringUtils.hasText(extractedUserId)) {
            // no userId at all — skip filter
            return chain.filter(exchange);
        }

        // must be final for lambda
        final String finalUserId = extractedUserId;
        final RegisterRequest finalRegisterRequest = parsedRequest;

        return userService.validateUser(finalUserId)
                .flatMap(exists -> {
                    if (!exists) {
                        if (finalRegisterRequest != null) {
                            return userService.registerUser(finalRegisterRequest)
                                    .then(Mono.empty());
                        }
                        log.info("User {} not found but register info missing, skipping registration", finalUserId);
                        return Mono.empty();
                    } else {
                        log.info("User {} already exists, skipping sync", finalUserId);
                        return Mono.empty();
                    }
                })
                .then(Mono.defer(() -> {
                    // add X-User-ID header to downstream services
                    ServerHttpRequest mutatedRequest = exchange.getRequest().mutate()
                            .header("X-User-ID", finalUserId)
                            .build();
                    return chain.filter(exchange.mutate().request(mutatedRequest).build());
                }))
                .onErrorResume(ex -> {
                    log.warn("Error in KeyCloakUserSyncFilter (ignored): {}", ex.toString());
                    return chain.filter(exchange);
                });
    }

    private RegisterRequest safeParseRegisterRequest(String authHeader) {
        try {
            String token = authHeader.substring(7).trim(); // remove "Bearer "
            SignedJWT jwt = SignedJWT.parse(token);
            JWTClaimsSet claims = jwt.getJWTClaimsSet();

            RegisterRequest req = new RegisterRequest();
            req.setEmail(claims.getStringClaim("email"));
            req.setKeyCloakId(claims.getStringClaim("sub"));
            req.setPassword("dummy@123123");
            req.setFirstName(claims.getStringClaim("given_name"));
            req.setLastName(claims.getStringClaim("family_name"));
            return req;

        } catch (Exception ex) {
            log.warn("Failed to parse JWT: {}", ex.toString());
            return null;
        }
    }

    private boolean isStaticOrPublicPath(String path) {
        if (path == null) return true;
        return path.equals("/")
                || path.startsWith("/index.html")
                || path.startsWith("/dashboard.html")
                || path.startsWith("/activity.html")
                || path.startsWith("/register.html")
                || path.startsWith("/keycloak/")
                || path.startsWith("/static/")
                || path.startsWith("/assets/")
                || path.endsWith(".js")
                || path.endsWith(".css")
                || path.endsWith(".png")
                || path.endsWith(".jpg")
                || path.endsWith(".svg")
                || path.endsWith(".ico")
                || path.startsWith("/favicon");
    }
}
