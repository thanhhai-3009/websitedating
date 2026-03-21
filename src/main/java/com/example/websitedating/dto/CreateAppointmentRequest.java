package com.example.websitedating.dto;

import java.time.Instant;

public class CreateAppointmentRequest {
    private String title;
    private String participantId;
    private Instant scheduledTime;
    private String location;
    private String note;
    private Double estimatedCost;

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getParticipantId() { return participantId; }
    public void setParticipantId(String participantId) { this.participantId = participantId; }

    public Instant getScheduledTime() { return scheduledTime; }
    public void setScheduledTime(Instant scheduledTime) { this.scheduledTime = scheduledTime; }

    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }

    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }

    public Double getEstimatedCost() { return estimatedCost; }
    public void setEstimatedCost(Double estimatedCost) { this.estimatedCost = estimatedCost; }
}
