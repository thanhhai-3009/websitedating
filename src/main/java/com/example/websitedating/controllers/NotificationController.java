package com.example.websitedating.controllers;

import com.example.websitedating.models.Notification;
import com.example.websitedating.services.NotificationService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/notifications")
@CrossOrigin(origins = "*", maxAge = 3600)
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping("/unread")
    public List<Notification> getUnreadNotifications(@RequestParam String clerkId) {
        return notificationService.getUnreadNotifications(clerkId);
    }

    @GetMapping
    public List<Notification> getAllNotifications(@RequestParam String clerkId) {
        return notificationService.getAllNotifications(clerkId);
    }

    @PutMapping("/{id}/read")
    public void markAsRead(@PathVariable String id, @RequestParam String clerkId) {
        notificationService.markAsRead(id, clerkId);
    }
}
