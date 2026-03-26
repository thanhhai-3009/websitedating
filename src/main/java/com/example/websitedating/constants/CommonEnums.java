package com.example.websitedating.constants;

public class CommonEnums {
    public enum RecentActionType { view, like, pass, match, message, appointment }

    public enum InteractionType { like, friend_request, match_invite }
    public enum ConnectionStatus { pending, liked, matched, accepted, rejected, blocked, canceled }
    public enum MatchedBy { manual, geo, interest, behavior, hybrid }

    public enum MessageType { text, image, emoji }
    public enum MediaType { image, video, audio, file, sticker }
    public enum DeliveryStatus { sending, sent, delivered, read }

    public enum VideoCallStatus { ringing, accepted, rejected, missed, ended, failed }

    public enum AppointmentStatus { proposed, scheduled, completed, canceled, rescheduled, incomplete }
    public enum SuggestionSource { manual, system_recommendation }

    public enum NotificationType {
        new_message, new_match, upcoming_appointment, connection_liked,
        connection_request, appointment_updated, video_call_incoming, system
    }
    public enum NotificationChannel { in_app, push, email }

    public enum ReportCategory { spam, harassment, fake_profile, scam, inappropriate_content, underage_user, other }
    public enum ReportStatus { pending, resolved, dismissed, reviewed }

    public enum ReasonTag { same_interest, nearby, similar_behavior, mutual_connection, profile_similarity, recommended }
}
