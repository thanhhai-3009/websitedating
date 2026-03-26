package com.example.websitedating.services;

import com.example.websitedating.models.User;
import jakarta.mail.internet.MimeMessage;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

@Service
public class BanEmailService {
    private static final Logger logger = LoggerFactory.getLogger(BanEmailService.class);
    private static final DateTimeFormatter DATE_TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm, dd MMM yyyy");

    private final JavaMailSender mailSender;

    @Value("${app.mail.enabled:false}")
    private boolean mailEnabled;

    @Value("${app.mail.from:}")
    private String mailFrom;

    @Value("${spring.mail.username:}")
    private String smtpUsername;

    @Value("${app.mail.timezone:Asia/Ho_Chi_Minh}")
    private String timeZone;

    public BanEmailService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    public void sendBanEmail(User user, String reason, Instant banExpiresAt) {
        if (!mailEnabled || user == null || user.getEmail() == null || user.getEmail().isBlank()) {
            return;
        }

        String sender = resolveSender();
        if (sender == null || sender.isBlank()) {
            logger.warn("Skip ban email because sender is empty");
            return;
        }

        try {
            String recipientEmail = user.getEmail().trim();
            String recipientName = displayName(user);
            String safeReason = (reason == null || reason.isBlank())
                    ? "Violation of community guidelines"
                    : reason.trim();
            String expiresLabel = formatExpiry(banExpiresAt);

            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, "utf-8");
            helper.setFrom(sender.trim());
            helper.setTo(recipientEmail);
            helper.setSubject("[Heartly] Account Access Temporarily Restricted");
            helper.setText(buildHtml(recipientName, safeReason, expiresLabel), true);
            mailSender.send(message);
        } catch (Exception ex) {
            logger.error("Failed to send ban email to userId={}, email={}", user.getId(), user.getEmail(), ex);
        }
    }

    private String resolveSender() {
        if (mailFrom != null && !mailFrom.trim().isBlank()) {
            return mailFrom.trim();
        }
        if (smtpUsername != null && !smtpUsername.trim().isBlank()) {
            return smtpUsername.trim();
        }
        return null;
    }

    private String formatExpiry(Instant banExpiresAt) {
        if (banExpiresAt == null) {
            return "Until further notice";
        }
        ZoneId zone = ZoneId.of(timeZone == null || timeZone.isBlank() ? "Asia/Ho_Chi_Minh" : timeZone);
        return DATE_TIME_FORMATTER.withZone(zone).format(banExpiresAt) + " (" + zone + ")";
    }

    private String buildHtml(String recipientName, String reason, String expiresLabel) {
        return String.format(
                Locale.ROOT,
                "<!doctype html>"
                        + "<html lang=\"en\"><head><meta charset=\"utf-8\"/></head>"
                        + "<body style=\"margin:0;padding:24px;background:#f4f6fb;font-family:Segoe UI,Arial,sans-serif;color:#1f2937;\">"
                        + "<table role=\"presentation\" style=\"max-width:680px;margin:0 auto;background:#ffffff;border-radius:14px;border:1px solid #e5e7eb;overflow:hidden;\">"
                        + "<tr><td style=\"padding:20px 24px;background:linear-gradient(135deg,#ff416c,#ff4b2b);color:#fff;\">"
                        + "<h1 style=\"margin:0;font-size:22px;font-weight:700;\">Account Access Notice</h1>"
                        + "<p style=\"margin:8px 0 0;font-size:14px;opacity:.95;\">Heartly Safety & Moderation Team</p>"
                        + "</td></tr>"
                        + "<tr><td style=\"padding:24px;\">"
                        + "<p style=\"margin:0 0 12px;font-size:15px;\">Hi %s,</p>"
                        + "<p style=\"margin:0 0 16px;font-size:15px;line-height:1.6;\">"
                        + "Your account has been temporarily restricted due to a moderation action. "
                        + "During this period, you will not be able to access Heartly."
                        + "</p>"
                        + "<div style=\"background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:14px 16px;margin:0 0 16px;\">"
                        + "<p style=\"margin:0 0 8px;font-size:13px;color:#9a3412;font-weight:700;letter-spacing:.03em;text-transform:uppercase;\">Restriction Details</p>"
                        + "<p style=\"margin:0 0 6px;font-size:14px;\"><strong>Reason:</strong> %s</p>"
                        + "<p style=\"margin:0;font-size:14px;\"><strong>Access Restored:</strong> %s</p>"
                        + "</div>"
                        + "<p style=\"margin:0 0 10px;font-size:14px;line-height:1.6;color:#4b5563;\">"
                        + "Once the restriction period ends, your access will be restored automatically and you can continue using the platform normally."
                        + "</p>"
                        + "<p style=\"margin:0;font-size:14px;line-height:1.6;color:#4b5563;\">"
                        + "If you believe this action was made in error, please contact support with your account email."
                        + "</p>"
                        + "<p style=\"margin:20px 0 0;font-size:14px;color:#111827;\">Regards,<br/><strong>Heartly Team</strong></p>"
                        + "</td></tr>"
                        + "</table>"
                        + "</body></html>",
                recipientName,
                escapeHtml(reason),
                escapeHtml(expiresLabel));
    }

    private String displayName(User user) {
        if (user.getProfile() != null
                && user.getProfile().getPersonalInfo() != null
                && user.getProfile().getPersonalInfo().getName() != null
                && !user.getProfile().getPersonalInfo().getName().isBlank()) {
            return user.getProfile().getPersonalInfo().getName();
        }
        if (user.getUsername() != null && !user.getUsername().isBlank()) {
            return user.getUsername();
        }
        return "there";
    }

    private String escapeHtml(String value) {
        if (value == null) {
            return "";
        }
        return value
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }
}

