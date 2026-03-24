package com.example.websitedating.services;

import com.example.websitedating.dto.CreateMomoPaymentResponse;
import com.example.websitedating.dto.PremiumStatusResponse;
import com.example.websitedating.models.PaymentTransaction;
import com.example.websitedating.models.User;
import com.example.websitedating.repository.PaymentTransactionRepository;
import com.example.websitedating.repository.UserRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class MomoPaymentService {

    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};

    private final UserRepository userRepository;
    private final PaymentTransactionRepository paymentTransactionRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newHttpClient();

    @Value("${app.momo.partner-code:}")
    private String partnerCode;

    @Value("${app.momo.access-key:}")
    private String accessKey;

    @Value("${app.momo.secret-key:}")
    private String secretKey;

    @Value("${app.momo.endpoint:}")
    private String endpoint;

    @Value("${app.momo.request-type:captureWallet}")
    private String requestType;

    @Value("${app.momo.redirect-url:http://localhost:8080/api/payments/momo/return}")
    private String redirectUrl;

    @Value("${app.momo.ipn-url:http://localhost:8080/api/payments/momo/ipn}")
    private String ipnUrl;

    @Value("${app.momo.frontend-return-url:http://localhost:5173/payment}")
    private String frontendReturnUrl;

    public MomoPaymentService(
            UserRepository userRepository,
            PaymentTransactionRepository paymentTransactionRepository) {
        this.userRepository = userRepository;
        this.paymentTransactionRepository = paymentTransactionRepository;
    }

    public CreateMomoPaymentResponse createPayment(String principal, String rawPlanId) {
        ensureMomoConfigured();

        User user = resolveUserByPrincipal(principal);
        String planId = normalizePlanId(rawPlanId);
        long amount = resolveAmount(planId);

        String orderId = "MM" + System.currentTimeMillis() + randomSuffix();
        String requestId = UUID.randomUUID().toString();
        String orderInfo = "Premium " + planId + " subscription";
        String extraData = Base64.getEncoder().encodeToString((user.getId() + "|" + planId).getBytes(StandardCharsets.UTF_8));

        Map<String, String> signingFields = new LinkedHashMap<>();
        signingFields.put("accessKey", accessKey);
        signingFields.put("amount", String.valueOf(amount));
        signingFields.put("extraData", extraData);
        signingFields.put("ipnUrl", ipnUrl);
        signingFields.put("orderId", orderId);
        signingFields.put("orderInfo", orderInfo);
        signingFields.put("partnerCode", partnerCode);
        signingFields.put("redirectUrl", redirectUrl);
        signingFields.put("requestId", requestId);
        signingFields.put("requestType", requestType);

        String signature = sign(buildRawString(signingFields));

        Map<String, Object> requestPayload = new LinkedHashMap<>();
        requestPayload.put("partnerCode", partnerCode);
        requestPayload.put("requestId", requestId);
        requestPayload.put("amount", String.valueOf(amount));
        requestPayload.put("orderId", orderId);
        requestPayload.put("orderInfo", orderInfo);
        requestPayload.put("redirectUrl", redirectUrl);
        requestPayload.put("ipnUrl", ipnUrl);
        requestPayload.put("lang", "en");
        requestPayload.put("requestType", requestType);
        requestPayload.put("autoCapture", true);
        requestPayload.put("extraData", extraData);
        requestPayload.put("signature", signature);

        try {
            String requestJson = objectMapper.writeValueAsString(requestPayload);
            HttpRequest httpRequest = HttpRequest.newBuilder()
                    .uri(URI.create(endpoint))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(requestJson))
                    .build();

            HttpResponse<String> response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());
            Map<String, Object> responseBody = objectMapper.readValue(response.body(), MAP_TYPE);

            int resultCode = parseInt(responseBody.get("resultCode"));
            String message = String.valueOf(responseBody.getOrDefault("message", ""));
            String payUrl = asText(responseBody.get("payUrl"));

            PaymentTransaction transaction = PaymentTransaction.builder()
                    .orderId(orderId)
                    .requestId(requestId)
                    .userId(user.getId())
                    .clerkId(user.getClerkId())
                    .planId(planId)
                    .amount(amount)
                    .currency("VND")
                    .status(resultCode == 0 ? "PENDING" : "FAILED")
                    .payUrl(payUrl)
                    .resultCode(resultCode)
                    .message(message)
                    .rawPayload(response.body())
                    .createdAt(Instant.now())
                    .updatedAt(Instant.now())
                    .build();
            paymentTransactionRepository.save(transaction);

            if (resultCode != 0 || payUrl == null || payUrl.isBlank()) {
                throw new IllegalArgumentException("Could not initialize MoMo payment: " + message);
            }

            return new CreateMomoPaymentResponse(orderId, payUrl);
        } catch (IllegalArgumentException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new IllegalArgumentException("MoMo request failed");
        }
    }

    public String processReturn(Map<String, String> queryParams) {
        processCallback(queryParams);

        String status = "0".equals(queryParams.get("resultCode")) ? "success" : "failed";
        String message = queryParams.getOrDefault("message", status.equals("success") ? "Payment successful" : "Payment failed");
        String orderId = queryParams.getOrDefault("orderId", "");
        String planId = resolvePlanForReturn(orderId, queryParams.get("extraData"));

        String redirect = frontendReturnUrl
                + "?momoStatus=" + urlEncode(status)
                + "&orderId=" + urlEncode(orderId)
                + "&momoMessage=" + urlEncode(message);

        if (!isBlank(planId)) {
            redirect += "&plan=" + urlEncode(planId);
        }

        return redirect;
    }

    public Map<String, Object> processIpn(Map<String, Object> payload) {
        Map<String, String> normalized = new LinkedHashMap<>();
        for (Map.Entry<String, Object> entry : payload.entrySet()) {
            if (entry.getValue() == null) {
                continue;
            }
            normalized.put(entry.getKey(), String.valueOf(entry.getValue()));
        }

        processCallback(normalized);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("resultCode", 0);
        response.put("message", "OK");
        return response;
    }

    public PremiumStatusResponse premiumStatus(String principal) {
        User user = resolveUserByPrincipal(principal);
        return new PremiumStatusResponse(user.hasActivePremium(), user.getPremiumPlan(), user.getPremiumExpiresAt());
    }

    private void processCallback(Map<String, String> fields) {
        if (!verifySignature(fields)) {
            throw new IllegalArgumentException("Invalid MoMo signature");
        }

        String orderId = fields.get("orderId");
        Optional<PaymentTransaction> transactionOpt = paymentTransactionRepository.findByOrderId(orderId);
        if (transactionOpt.isEmpty()) {
            return;
        }

        PaymentTransaction transaction = transactionOpt.get();
        int resultCode = parseInt(fields.get("resultCode"));
        String message = fields.get("message");
        String transId = fields.get("transId");

        transaction.setResultCode(resultCode);
        transaction.setMessage(message);
        transaction.setTransId(transId);
        transaction.setRawPayload(safeJson(fields));
        transaction.setUpdatedAt(Instant.now());

        if (resultCode == 0) {
            if (!"SUCCESS".equals(transaction.getStatus())) {
                transaction.setStatus("SUCCESS");
                transaction.setPaidAt(Instant.now());
                activatePremium(transaction);
            }
        } else {
            transaction.setStatus("FAILED");
        }

        paymentTransactionRepository.save(transaction);
    }

    private void activatePremium(PaymentTransaction transaction) {
        userRepository.findById(transaction.getUserId()).ifPresent(user -> {
            Instant now = Instant.now();
            Instant base = user.getPremiumExpiresAt() != null && user.getPremiumExpiresAt().isAfter(now)
                    ? user.getPremiumExpiresAt()
                    : now;

            user.setPremiumPlan(transaction.getPlanId());
            user.setPremiumExpiresAt(base.plus(resolveDurationDays(transaction.getPlanId()), ChronoUnit.DAYS));
            userRepository.save(user);
        });
    }

    private User resolveUserByPrincipal(String principal) {
        if (principal == null || principal.isBlank()) {
            throw new IllegalArgumentException("Unauthorized payment request");
        }

        return userRepository.findByClerkId(principal)
                .or(() -> userRepository.findByEmailIgnoreCase(principal.toLowerCase(Locale.ROOT)))
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
    }

    private String normalizePlanId(String rawPlanId) {
        String planId = rawPlanId == null ? "" : rawPlanId.trim().toLowerCase(Locale.ROOT);
        if (!"gold".equals(planId) && !"platinum".equals(planId)) {
            throw new IllegalArgumentException("Unsupported premium plan");
        }
        return planId;
    }

    private long resolveAmount(String planId) {
        if ("platinum".equals(planId)) {
            return 299000L;
        }
        return 149000L;
    }

    private long resolveDurationDays(String planId) {
        if ("platinum".equals(planId)) {
            return 30L;
        }
        return 30L;
    }

    private String resolvePlanForReturn(String orderId, String extraData) {
        if (!isBlank(orderId)) {
            Optional<PaymentTransaction> transaction = paymentTransactionRepository.findByOrderId(orderId);
            if (transaction.isPresent()) {
                String planId = normalizeReturnPlan(transaction.get().getPlanId());
                if (planId != null) {
                    return planId;
                }
            }
        }

        return decodePlanFromExtraData(extraData);
    }

    private String decodePlanFromExtraData(String extraData) {
        if (isBlank(extraData)) {
            return null;
        }

        try {
            String decoded = new String(Base64.getDecoder().decode(extraData), StandardCharsets.UTF_8);
            String[] parts = decoded.split("\\|", 2);
            if (parts.length < 2) {
                return null;
            }
            return normalizeReturnPlan(parts[1]);
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private String normalizeReturnPlan(String planId) {
        if (isBlank(planId)) {
            return null;
        }

        String normalized = planId.trim().toLowerCase(Locale.ROOT);
        if ("gold".equals(normalized) || "platinum".equals(normalized)) {
            return normalized;
        }
        return null;
    }

    private boolean verifySignature(Map<String, String> fields) {
        String provided = fields.get("signature");
        if (provided == null || provided.isBlank()) {
            return false;
        }

        Map<String, String> signingFields = new LinkedHashMap<>();
        // MoMo callback signature requires this exact field order.
        signingFields.put("accessKey", accessKey);
        signingFields.put("amount", orEmpty(fields.get("amount")));
        signingFields.put("extraData", orEmpty(fields.get("extraData")));
        signingFields.put("message", orEmpty(fields.get("message")));
        signingFields.put("orderId", orEmpty(fields.get("orderId")));
        signingFields.put("orderInfo", orEmpty(fields.get("orderInfo")));
        signingFields.put("orderType", orEmpty(fields.get("orderType")));
        signingFields.put("partnerCode", orEmpty(fields.get("partnerCode")));
        signingFields.put("payType", orEmpty(fields.get("payType")));
        signingFields.put("requestId", orEmpty(fields.get("requestId")));
        signingFields.put("responseTime", orEmpty(fields.get("responseTime")));
        signingFields.put("resultCode", orEmpty(fields.get("resultCode")));
        signingFields.put("transId", orEmpty(fields.get("transId")));

        String expected = sign(buildRawString(signingFields));
        return provided.equals(expected);
    }

    private String orEmpty(String value) {
        return value == null ? "" : value;
    }

    private String buildRawString(Map<String, String> fields) {
        StringBuilder builder = new StringBuilder();
        for (Map.Entry<String, String> entry : fields.entrySet()) {
            if (builder.length() > 0) {
                builder.append('&');
            }
            builder.append(entry.getKey()).append('=').append(entry.getValue());
        }
        return builder.toString();
    }

    private String sign(String rawData) {
        try {
            Mac hmac = Mac.getInstance("HmacSHA256");
            SecretKeySpec keySpec = new SecretKeySpec(secretKey.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            hmac.init(keySpec);
            byte[] bytes = hmac.doFinal(rawData.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder();
            for (byte value : bytes) {
                String item = Integer.toHexString(0xff & value);
                if (item.length() == 1) {
                    hex.append('0');
                }
                hex.append(item);
            }
            return hex.toString();
        } catch (Exception ex) {
            throw new IllegalArgumentException("Failed to sign MoMo payload");
        }
    }

    private int parseInt(Object value) {
        if (value == null) {
            return -1;
        }
        try {
            return Integer.parseInt(String.valueOf(value));
        } catch (NumberFormatException ex) {
            return -1;
        }
    }

    private String asText(Object value) {
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value);
        return text.isBlank() ? null : text;
    }

    private void ensureMomoConfigured() {
        List<String> missing = new ArrayList<>();
        if (isBlank(partnerCode)) {
            missing.add("MOMO_PARTNER_CODE");
        }
        if (isBlank(accessKey)) {
            missing.add("MOMO_ACCESS_KEY");
        }
        if (isBlank(secretKey)) {
            missing.add("MOMO_SECRET_KEY");
        }
        if (isBlank(endpoint)) {
            missing.add("MOMO_ENDPOINT");
        }

        if (!missing.isEmpty()) {
            throw new IllegalArgumentException("MoMo configuration is missing: " + String.join(", ", missing));
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private String safeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception ex) {
            return "{}";
        }
    }

    private String randomSuffix() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 6).toUpperCase(Locale.ROOT);
    }

    private String urlEncode(String value) {
        return URLEncoder.encode(value == null ? "" : value, StandardCharsets.UTF_8);
    }
}


