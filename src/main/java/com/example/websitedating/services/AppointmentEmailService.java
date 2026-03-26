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

                String placeName = appointment.getLocation() != null && appointment.getLocation().getPlaceName() != null
                    ? appointment.getLocation().getPlaceName()
                    : "Not provided";
                String address = appointment.getLocation() != null && appointment.getLocation().getAddress() != null
                    ? appointment.getLocation().getAddress()
                    : "Not provided";

                MimeMessage mimeMessage = mailSender.createMimeMessage();
                MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, "utf-8");
                String htmlBody = buildHtmlBody(recipientName, otherName, appointment, formattedTime, placeName, address);
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
            String formattedTime,
            String placeName,
            String address
        ) {
        String title = appointment.getTitle() == null || appointment.getTitle().isBlank()
            ? "Appointment"
            : appointment.getTitle();
        String appointmentId = appointment.getId() == null ? "(pending)" : appointment.getId();

        return String.format(
            Locale.ROOT,
            "<!doctype html>"
                + "<html lang=\"en\"><head><meta charset=\"utf-8\"/></head>"
                + "<body style=\"margin:0;padding:20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#0b1220;line-height:1.4;\">"
                + "<div style=\"max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e6e9ee;padding:20px;border-radius:8px;\">"
                + "<h1 style=\"font-size:20px;margin:0 0 8px;\">Appointment Confirmation</h1>"
                + "<p style=\"margin:0 0 12px;color:#55607a;\">Hello %s,</p>"
                + "<p style=\"margin:0 0 12px;color:#334155;\">Your appointment has been scheduled. Please find the details below.</p>"
                + "<table role=\"presentation\" style=\"width:100%%;border-collapse:collapse;font-size:14px;color:#16324f;\">"
                + "<tr><td style=\"padding:6px 0;width:140px;color:#55607a;font-weight:600;\">Title</td><td style=\"padding:6px 0;\">%s</td></tr>"
                + "<tr><td style=\"padding:6px 0;color:#55607a;font-weight:600;\">With</td><td style=\"padding:6px 0;\">%s</td></tr>"
                + "<tr><td style=\"padding:6px 0;color:#55607a;font-weight:600;\">Date & Time</td><td style=\"padding:6px 0;\">%s</td></tr>"
                + "<tr><td style=\"padding:6px 0;color:#55607a;font-weight:600;\">Location</td><td style=\"padding:6px 0;\">%s</td></tr>"
                + "<tr><td style=\"padding:6px 0;color:#55607a;font-weight:600;\">Address</td><td style=\"padding:6px 0;\">%s</td></tr>"
                + "<tr><td style=\"padding:6px 0;color:#55607a;font-weight:600;\">Appointment ID</td><td style=\"padding:6px 0;\">%s</td></tr>"
                + "</table>"
                + "<p style=\"margin:16px 0 0;color:#667085;\">Please open the app to view or update your appointment.</p>"
                + "<p style=\"margin:16px 0 0;color:#334155;\">Regards,<br/>Heartly Team</p>"
                + "</div></body></html>",
            recipientName,
            title,
            otherName,
            formattedTime,
            placeName,
            address,
            appointmentId
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
