package com.example.websitedating.controllers;

import com.example.websitedating.models.User;
import com.example.websitedating.repository.UserRepository;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/admin")
public class AdminController {

    private final UserRepository userRepository;

    public AdminController(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @GetMapping
    public String adminPage() {
        List<User> users = userRepository.findAll();
        StringBuilder sb = new StringBuilder();
        sb.append("<html><head><title>Admin</title></head><body>");
        sb.append("<h1>Admin Dashboard</h1>");
        sb.append("<h2>Users ("+users.size()+")</h2>");
        sb.append("<ul>");
        for (User u : users) {
            sb.append("<li>");
            sb.append("id: ").append(u.getId()).append(" - ");
            sb.append("email: ").append(u.getEmail()).append(" - ");
            sb.append("username: ").append(u.getUsername());
            sb.append("</li>");
        }
        sb.append("</ul>");
        sb.append("</body></html>");
        return sb.toString();
    }
}
