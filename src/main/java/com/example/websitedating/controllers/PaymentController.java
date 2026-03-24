package com.example.websitedating.controllers;

import com.example.websitedating.dto.CreateMomoPaymentRequest;
import com.example.websitedating.dto.CreateMomoPaymentResponse;
import com.example.websitedating.dto.PremiumStatusResponse;
import com.example.websitedating.services.MomoPaymentService;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/payments")
public class PaymentController {

    private final MomoPaymentService momoPaymentService;

    public PaymentController(MomoPaymentService momoPaymentService) {
        this.momoPaymentService = momoPaymentService;
    }

    @PostMapping("/momo/create")
    public CreateMomoPaymentResponse createMomoPayment(
            Authentication authentication,
            @Valid @RequestBody CreateMomoPaymentRequest request) {
        return momoPaymentService.createPayment(authentication.getName(), request.getPlanId());
    }

    @GetMapping("/momo/return")
    public ResponseEntity<Void> momoReturn(@RequestParam Map<String, String> queryParams) {
        String redirectUrl = momoPaymentService.processReturn(queryParams);
        return ResponseEntity.status(HttpStatus.FOUND).location(URI.create(redirectUrl)).build();
    }

    @PostMapping("/momo/ipn")
    public Map<String, Object> momoIpn(@RequestBody Map<String, Object> payload) {
        try {
            return momoPaymentService.processIpn(payload);
        } catch (Exception ex) {
            Map<String, Object> error = new LinkedHashMap<>();
            error.put("resultCode", 1001);
            error.put("message", "Invalid callback");
            return error;
        }
    }

    @GetMapping("/premium/status")
    public PremiumStatusResponse premiumStatus(Authentication authentication) {
        return momoPaymentService.premiumStatus(authentication.getName());
    }
}

