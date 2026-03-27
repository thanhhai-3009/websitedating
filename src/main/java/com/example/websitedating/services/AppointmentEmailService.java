package com.example.websitedating.services;

import com.example.websitedating.models.Appointment;
import com.example.websitedating.models.User;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.MimeMessageHelper;
import jakarta.mail.internet.MimeMessage;
import org.springframework.mail.javamail.JavaMailSender;
import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Service;

@Service
public class AppointmentEmailService {
    private static final Logger logger = LoggerFactory.getLogger(AppointmentEmailService.class);
    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm, dd/MM/yyyy");
    private static final DateTimeFormatter DATE_ONLY_FORMATTER = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter TIME_ONLY_FORMATTER = DateTimeFormatter.ofPattern("HH:mm");

    private final JavaMailSender mailSender;

    @Value("${app.mail.enabled:false}")
    private boolean mailEnabled;

    @Value("${app.mail.from:}")
    private String mailFrom;

    @Value("${spring.mail.username:}")
    private String smtpUsername;

    @PostConstruct
    public void normalizeConfiguredValues() {
        if (mailFrom != null) mailFrom = mailFrom.trim();
        if (smtpUsername != null) smtpUsername = smtpUsername.trim();
    }

    @Value("${app.mail.timezone:Asia/Ho_Chi_Minh}")
    private String timeZone;

    @Value("${app.frontend.url:http://localhost:5173}")
    private String frontendUrl;

    public AppointmentEmailService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    public void sendCreatedAppointmentEmail(User recipient, User otherParty, Appointment appointment) {
        if (!mailEnabled) {
            logger.info("Skip appointment email: app.mail.enabled=false, appointmentId={}", appointment != null ? appointment.getId() : null);
            return;
        }
        if (recipient == null || recipient.getEmail() == null || recipient.getEmail().isBlank()) {
            logger.warn(
                    "Skip appointment email: recipient email is empty, appointmentId={}, recipientId={}, recipientClerkId={}",
                    appointment != null ? appointment.getId() : null,
                    recipient != null ? recipient.getId() : null,
                    recipient != null ? recipient.getClerkId() : null
            );
            return;
        }
        // trim recipient email to avoid accidental spaces
        String recipientEmail = recipient.getEmail().trim();
        if (recipientEmail.isBlank()) {
            logger.warn("Skip appointment email: recipient email blank after trim, appointmentId={}, recipientId={}", appointment != null ? appointment.getId() : null, recipient != null ? recipient.getId() : null);
            return;
        }
        String sender = resolveSender();
        if (sender == null || sender.isBlank()) {
            logger.warn(
                    "Skip appointment email: sender email is empty. Configure app.mail.from or spring.mail.username, appointmentId={}",
                    appointment != null ? appointment.getId() : null
            );
            return;
        }

        try {
            String recipientName = displayName(recipient);
            String otherName = displayName(otherParty);
                String formattedTime = appointment.getScheduledTime() == null
                    ? "Not specified"
                    : TIME_FORMATTER.withZone(ZoneId.of(timeZone)).format(appointment.getScheduledTime());
                String dateOnly = appointment.getScheduledTime() == null
                    ? "Not specified"
                    : DATE_ONLY_FORMATTER.withZone(ZoneId.of(timeZone)).format(appointment.getScheduledTime());
                String timeOnly = appointment.getScheduledTime() == null
                    ? "Not specified"
                    : TIME_ONLY_FORMATTER.withZone(ZoneId.of(timeZone)).format(appointment.getScheduledTime());

                String placeName = appointment.getLocation() != null && appointment.getLocation().getPlaceName() != null
                    ? appointment.getLocation().getPlaceName()
                    : "Not provided";
                String address = appointment.getLocation() != null && appointment.getLocation().getAddress() != null
                    ? appointment.getLocation().getAddress()
                    : "Not provided";

                MimeMessage mimeMessage = mailSender.createMimeMessage();
                MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, "utf-8");
                String appointmentIdForLink = (appointment != null && appointment.getId() != null) ? appointment.getId() : "pending";
                String base = frontendUrl == null ? "http://localhost:5173" : frontendUrl.trim();
                if (base.endsWith("/")) base = base.substring(0, base.length() - 1);
                String viewUrl = String.format("%s/appointments/%s", base, appointmentIdForLink);

                String htmlBody = buildHtmlBody(recipientName, otherName, appointment, dateOnly, timeOnly, placeName, address, viewUrl);
                helper.setFrom(sender != null ? sender.trim() : null);
                helper.setTo(recipientEmail);
                helper.setSubject("[Heartly] Appointment Confirmation");
                helper.setText(htmlBody, true);

                // user-requested console logs for tracing
                System.out.println("Sending email... to=" + recipientEmail + " from=" + (sender != null ? sender.trim() : ""));
                try {
                mailSender.send(mimeMessage);
                System.out.println("Status: Success");
                logger.info(
                    "Appointment email sent, appointmentId={}, to={}, from={}",
                    appointment != null ? appointment.getId() : null,
                    recipientEmail,
                    sender
                );
                } catch (Exception sendEx) {
                System.out.println("Status: Error - " + sendEx.getMessage());
                logger.error(
                    "Failed to send appointment email for appointmentId={}, to={}, smtpUser={}",
                    appointment != null ? appointment.getId() : null,
                    recipientEmail,
                    Optional.ofNullable(smtpUsername).orElse(""),
                    sendEx
                );
                throw sendEx;
                }
        } catch (Exception ex) {
            logger.error(
                    "Failed to send appointment email for appointmentId={}, to={}, smtpUser={}",
                    appointment != null ? appointment.getId() : null,
                    recipient.getEmail(),
                    Optional.ofNullable(smtpUsername).orElse(""),
                    ex
            );
        }
    }

    private String resolveSender() {
        if (mailFrom != null && !mailFrom.isBlank()) {
            return mailFrom.trim();
        }
        if (smtpUsername != null && !smtpUsername.isBlank()) {
            return smtpUsername.trim();
        }
        return null;
    }

        private String buildHtmlBody(
            String recipientName,
            String otherName,
            Appointment appointment,
            String dateOnly,
            String timeOnly,
            String placeName,
            String address,
            String viewUrl
        ) {
        String service = appointment.getTitle() == null || appointment.getTitle().isBlank()
            ? "Service"
            : appointment.getTitle();
        String appointmentId = appointment.getId() == null ? "(pending)" : appointment.getId();

        // Build a clean, professional English HTML email with improved styling
        return String.format(
            Locale.ROOT,
            "<!doctype html>"
                + "<html lang=\"en\"><head><meta charset=\"utf-8\"/></head>"
                + "<body style=\"margin:0;padding:20px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#0b1220;line-height:1.4;background:#f3f6fb;\">"
                + "<div style=\"max-width:680px;margin:20px auto;background:#ffffff;border-radius:8px;box-shadow:0 6px 24px rgba(11,61,145,0.08);overflow:hidden;\">"
                + "<div style=\"background:#0b3d91;color:#ffffff;padding:18px 22px;\">"
                + "<h2 style=\"margin:0;font-size:20px;font-weight:600;\">Appointment Confirmation</h2>"
                + "</div>"
                + "<div style=\"padding:22px;\">"
                + "<p style=\"margin:0 0 10px;color:#55607a;\">Hello %s,</p>"
                + "<p style=\"margin:0 0 18px;color:#334155;\">Your appointment has been scheduled. Please find the details below.</p>"
                + "<div style=\"font-size:15px;color:#16324f;line-height:1.6;\">"
                + "<p><span style=\"margin-right:8px;\">📅</span><strong>Date:</strong> %s</p>"
                + "<p><span style=\"margin-right:8px;\">⏰</span><strong>Time:</strong> %s</p>"
                + "<p><span style=\"margin-right:8px;\">🛠️</span><strong>Service:</strong> %s</p>"
                + "<p><span style=\"margin-right:8px;\">👤</span><strong>With:</strong> %s</p>"
                + "<p><span style=\"margin-right:8px;\">📍</span><strong>Location:</strong> %s</p>"
                + "<p><span style=\"margin-right:8px;\">🏠</span><strong>Address:</strong> %s</p>"
                + "<p><span style=\"margin-right:8px;\">🆔</span><strong>Appointment ID:</strong> %s</p>"
                + "</div>"
                + "<div style=\"margin-top:20px;text-align:center;\">"
                + "<a href=\"%s\" style=\"display:inline-block;background:#0b3d91;color:#ffffff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:600;\">View Appointment</a>"
                + "</div>"
                + "<p style=\"margin:18px 0 0;color:#667085;\">Please open the app to view or update your appointment.</p>"
                + "<p style=\"margin:16px 0 0;color:#334155;\">Best regards,<br/>[Your Team]</p>"
                + "</div></div></body></html>",
            recipientName,
            dateOnly,
            timeOnly,
            service,
            otherName,
            placeName,
            address,
            appointmentId,
            viewUrl
        );
        }

    private String displayName(User user) {
        if (user == null) {
            return "Customer";
        }
        if (user.getProfile() != null
                && user.getProfile().getPersonalInfo() != null
                && user.getProfile().getPersonalInfo().getName() != null
                && !user.getProfile().getPersonalInfo().getName().isBlank()) {
            return user.getProfile().getPersonalInfo().getName();
        }
        if (user.getUsername() != null && !user.getUsername().isBlank()) {
            return user.getUsername();
        }
        if (user.getEmail() != null && !user.getEmail().isBlank()) {
            return user.getEmail();
        }
        return "Customer";
    }
}
