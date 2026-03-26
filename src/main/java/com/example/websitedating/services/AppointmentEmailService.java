package com.example.websitedating.services;

import com.example.websitedating.models.Appointment;
import com.example.websitedating.models.User;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
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

    @Value("${app.mail.timezone:Asia/Ho_Chi_Minh}")
    private String timeZone;

    public AppointmentEmailService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    public void sendCreatedAppointmentEmail(User recipient, User otherParty, Appointment appointment) {
        if (!mailEnabled) {
            return;
        }
        if (recipient == null || recipient.getEmail() == null || recipient.getEmail().isBlank()) {
            return;
        }
        if (mailFrom == null || mailFrom.isBlank()) {
            logger.warn("SMTP sender is not configured (app.mail.from), skipping appointment email");
            return;
        }

        try {
            String recipientName = displayName(recipient);
            String otherName = displayName(otherParty);
            String formattedTime = appointment.getScheduledTime() == null
                    ? "Chua xac dinh"
                    : TIME_FORMATTER.withZone(ZoneId.of(timeZone)).format(appointment.getScheduledTime());

            String placeName = appointment.getLocation() != null && appointment.getLocation().getPlaceName() != null
                    ? appointment.getLocation().getPlaceName()
                    : "Chua cap nhat";
            String address = appointment.getLocation() != null && appointment.getLocation().getAddress() != null
                    ? appointment.getLocation().getAddress()
                    : "Chua cap nhat";

            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(mailFrom);
            message.setTo(recipient.getEmail());
            message.setSubject("[Heartly] Thong tin lich hen moi");
            message.setText(buildBody(recipientName, otherName, appointment, formattedTime, placeName, address));

            mailSender.send(message);
        } catch (Exception ex) {
            logger.error("Failed to send appointment email for appointmentId={}", appointment.getId(), ex);
        }
    }

    private String buildBody(
            String recipientName,
            String otherName,
            Appointment appointment,
            String formattedTime,
            String placeName,
            String address
    ) {
        String title = appointment.getTitle() == null || appointment.getTitle().isBlank()
                ? "Date Appointment"
                : appointment.getTitle();

        return String.format(
                Locale.ROOT,
                "Xin chao %s,\n\n"
                        + "Lich hen cua ban da duoc tao thanh cong.\n\n"
                        + "Chi tiet lich hen:\n"
                        + "- Tieu de: %s\n"
                        + "- Nguoi hen cung: %s\n"
                        + "- Thoi gian: %s\n"
                        + "- Dia diem: %s\n"
                        + "- Dia chi: %s\n"
                        + "- Ma lich hen: %s\n\n"
                        + "Vui long mo ung dung de xem va cap nhat trang thai lich hen.\n\n"
                        + "Tran trong,\nHeartly Team",
                recipientName,
                title,
                otherName,
                formattedTime,
                placeName,
                address,
                appointment.getId() == null ? "(dang cap nhat)" : appointment.getId()
        );
    }

    private String displayName(User user) {
        if (user == null) {
            return "Khach hang";
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
        return "Khach hang";
    }
}
