package com.fitness.gateway;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.reactive.EnableWebFluxSecurity;
import org.springframework.security.config.web.server.ServerHttpSecurity;
import org.springframework.security.web.server.SecurityWebFilterChain;

@Configuration
@EnableWebFluxSecurity
public class SecurityConfig {

    @Bean
    public SecurityWebFilterChain springSecurityFilterChain(ServerHttpSecurity http) {
        return http
                .csrf(ServerHttpSecurity.CsrfSpec::disable)
                .authorizeExchange(exchanges -> exchanges

                        // Permit your static files explicitly
                        .pathMatchers("/", "/index.html", "/dashboard.html", "/activity.html", "/register.html").permitAll()
                        .pathMatchers("/*.js", "/*.css").permitAll()
                        .pathMatchers("/favicon.ico").permitAll()

                        // If you have a /static or /assets folder
                        .pathMatchers("/static/**").permitAll()
                        .pathMatchers("/assets/**").permitAll()

                        // Keycloak proxy (handles its own auth)
                        .pathMatchers("/keycloak/**").permitAll()

                        // Protect backend APIs
                        .pathMatchers("/api/**").authenticated()

                        // Everything else also authenticated
                        .anyExchange().authenticated()
                )
                .oauth2ResourceServer(oauth2 -> oauth2.jwt(Customizer.withDefaults()))
                .build();
    }
}
