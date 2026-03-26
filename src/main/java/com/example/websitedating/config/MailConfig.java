package com.example.websitedating.config;

import jakarta.annotation.PostConstruct;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.stereotype.Component;

@Component
public class MailConfig {
    private static final Logger logger = LoggerFactory.getLogger(MailConfig.class);

    private final JavaMailSender mailSender;

    @Value("${spring.mail.username:}")
    private String smtpUsername;

    @Value("${spring.mail.password:}")
    private String smtpPassword;

    public MailConfig(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    @PostConstruct
    public void sanitizeMailCredentials() {
        try {
            if (mailSender instanceof JavaMailSenderImpl) {
                JavaMailSenderImpl impl = (JavaMailSenderImpl) mailSender;
                String user = (smtpUsername == null) ? impl.getUsername() : smtpUsername;
                String pass = (smtpPassword == null) ? impl.getPassword() : smtpPassword;
                if (user != null) {
                    String tu = user.trim();
                    impl.setUsername(tu);
                    logger.info("SMTP username set (trimmed)");
                }
                if (pass != null) {
                    String tp = pass.trim();
                    impl.setPassword(tp);
                    logger.info("SMTP password set (trimmed). length={}", tp.length());
                }
            }
        } catch (Exception ex) {
            logger.warn("Could not sanitize mail credentials", ex);
        }
    }
}
