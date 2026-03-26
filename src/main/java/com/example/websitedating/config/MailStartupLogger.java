package com.example.websitedating.config;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class MailStartupLogger {
    @Value("${app.mail.enabled:false}")
    private boolean mailEnabled;

    @Value("${spring.mail.host:}")
    private String smtpHost;

    @Value("${spring.mail.port:}")
    private String smtpPort;

    @Value("${spring.mail.username:}")
    private String smtpUsername;

    @Value("${app.mail.from:}")
    private String mailFrom;

    @PostConstruct
    public void logMailConfig() {
        String maskedPwd = "(hidden)";
        System.out.println("[MailStartup] app.mail.enabled=" + mailEnabled);
        System.out.println("[MailStartup] spring.mail.host=" + (smtpHost == null ? "" : smtpHost));
        System.out.println("[MailStartup] spring.mail.port=" + (smtpPort == null ? "" : smtpPort));
        System.out.println("[MailStartup] spring.mail.username=" + (smtpUsername == null ? "" : smtpUsername));
        System.out.println("[MailStartup] app.mail.from=" + (mailFrom == null ? "" : mailFrom));
        System.out.println("[MailStartup] SMTP password=" + maskedPwd);

        if (smtpHost == null || smtpHost.isBlank()) {
            System.out.println("[MailStartup] WARNING: SMTP host is empty");
        }
        if (smtpPort == null || smtpPort.isBlank()) {
            System.out.println("[MailStartup] WARNING: SMTP port is empty");
        }
    }
}
