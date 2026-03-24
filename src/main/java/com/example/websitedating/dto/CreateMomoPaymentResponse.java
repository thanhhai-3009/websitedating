package com.example.websitedating.dto;

public class CreateMomoPaymentResponse {
    private String orderId;
    private String payUrl;

    public CreateMomoPaymentResponse() {
    }

    public CreateMomoPaymentResponse(String orderId, String payUrl) {
        this.orderId = orderId;
        this.payUrl = payUrl;
    }

    public String getOrderId() {
        return orderId;
    }

    public String getPayUrl() {
        return payUrl;
    }
}

