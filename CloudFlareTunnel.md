# 🚀 Hướng dẫn Setup Mạng & Fix Lỗi: Cloudflare Tunnels + Spring Boot + Vite/React

Tài liệu này là "xương máu" đúc kết từ quá trình debug thực tế để đưa một project (gồm Backend Spring Boot và Frontend React/Vite) từ `localhost` ra internet thông qua **Cloudflare Tunnels**.

Mục đích: Test ứng dụng trên thiết bị di động thực tế, test WebRTC (Video Call/Chat), và xử lý triệt để các lỗi liên quan đến mạng, CORS, và bảo mật.

---

## 🛠️ 1. Cài đặt và Chuẩn bị (`cloudflared`)

1. Tải `cloudflared.exe` cho Windows từ trang chủ Cloudflare.
2. Lưu file vào một thư mục cố định (VD: `C:\Program Files\cloudflared\`).
3. **Lưu ý quan trọng:** Nếu bạn gõ `cloudflared` trong terminal mà bị lỗi _Command not found_, hãy sử dụng **đường dẫn tuyệt đối** khi chạy lệnh (như các bước bên dưới).

---

## 🌐 2. Khởi chạy Tunnels (Mở 2 Terminal riêng biệt)

Để hệ thống hoạt động, bạn cần 2 luồng Tunnel riêng biệt cho Backend và Frontend.

### Terminal 1: Expose Backend (Spring Boot - Port 8080)

Chạy lệnh sau để expose API:

```powershell
& "C:\Program Files\cloudflared\cloudflared.exe" tunnel --url http://localhost:8080
(Lưu lại đường link https://<random-name-backend>.trycloudflare.com)

Terminal 2: Expose Frontend (Vite/React - Port 5173)
🚨 Bẫy chết người: Vite có cơ chế chặn host lạ. Nếu chạy lệnh bình thường sẽ bị lỗi 400 Bad Request. Bắt buộc phải ép Header lừa Vite rằng request đến từ localhost:
& "C:\Program Files\cloudflared\cloudflared.exe" tunnel --url http://localhost:5173 --http-host-header="localhost"
(Lưu lại đường link https://<random-name-frontend>.trycloudflare.com để mở chạy cả 2)
3. Cấu hình Frontend (React / Vite)
Mở file .env ở thư mục Frontend và cấu hình như sau.

🚨 Lưu ý: - Giao thức WebSocket khi đi qua Tunnels (HTTPS) phải đổi từ ws:// thành wss://.

KHÔNG ĐƯỢC để trùng tên biến trong .env (ví dụ 1 dòng cấu hình Cloudflare, 1 dòng cấu hình localhost ngay bên dưới), Vite sẽ ghi đè và làm sai lệch URL

# 🟢 CẤU HÌNH CLOUDFLARE (Dùng để test mobile/internet)
VITE_API_BASE_URL=https://<random-name-backend>.trycloudflare.com
VITE_WEBRTC_WS_URL=wss://<random-name-backend>[.trycloudflare.com/ws-signal](https://.trycloudflare.com/ws-signal)

# 🔴 CẤU HÌNH LOCALHOST (Phải comment lại khi dùng Cloudflare)
# VITE_API_BASE_URL=http://localhost:8080
# VITE_WEBRTC_WS_URL=ws://localhost:8080/ws-signal
🐛 Cách nhận biết lỗi sai URL ở Frontend:
Nếu bạn gặp lỗi Unexpected token '<', "<!doctype "... is not valid JSON:

Nguyên nhân: Frontend gọi sai URL (ví dụ gọi nhầm vào cổng 5173 của giao diện thay vì cổng API). Vite không tìm thấy route nên trả về file index.html. Trình duyệt cố parse HTML đó thành JSON và văng lỗi.

Cách fix: Đảm bảo code Axios/Fetch đang trỏ đúng vào biến import.meta.env.VITE_API_BASE_URL tuyệt đối.
4. Vượt ải "Trùm cuối": Fix CORS toàn tập (Spring Boot Backend)
Khi Frontend (ở domain A) gọi API/WebSocket sang Backend (ở domain B), Spring Security sẽ chặn đứng và văng lỗi 403 Forbidden hoặc CORS policy. Bắt buộc phải mở 3 "chốt chặn" sau trong source code Backend:

Chốt 1: Bỏ qua request Preflight (OPTIONS) trong bộ lọc JWT
Trình duyệt luôn gửi request OPTIONS (không mang theo Token) trước khi gọi API thật. Nếu JwtAuthenticationFilter chặn request này, quá trình kiểm tra CORS sẽ thất bại ngay lập tức.
👉 Sửa file JwtAuthenticationFilter.java: Thêm đoạn code này vào ngay dòng đầu tiên của hàm doFilterInternal:

@Override
protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
        throws ServletException, IOException {

    // Bỏ qua kiểm tra Token đối với request thăm dò (OPTIONS)
    if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
        response.setStatus(HttpServletResponse.SC_OK);
        return;
    }

    // ... logic kiểm tra JWT hiện tại của bạn ...
}
Chốt 2: Cấu hình CORS chính xác trong Spring Security
👉 Sửa file SecurityConfig.java: Tạo Bean cấu hình CORS và nạp vào FilterChain.
🚨 Lưu ý: Khi bật AllowCredentials(true), tuyệt đối KHÔNG ĐƯỢC dùng wildcard * cho AllowedMethods
@Bean
public CorsConfigurationSource corsConfigurationSource() {
    CorsConfiguration configuration = new CorsConfiguration();

    // 1. Phải dùng Pattern để hỗ trợ allowCredentials
    configuration.setAllowedOriginPatterns(List.of("*"));

    // 2. Bắt buộc liệt kê rõ Method, CẤM DÙNG List.of("*")
    configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));

    configuration.setAllowedHeaders(List.of("*"));

    // 3. Bắt buộc TRUE để Frontend gửi Token/Cookie
    configuration.setAllowCredentials(true);

    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/**", configuration);
    return source;
}

@Bean
public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
    http
        .cors(Customizer.withDefaults()) // KÍCH HOẠT CORS
        .csrf(csrf -> csrf.disable())
        // ... các cấu hình authorizeHttpRequests khác ...
    return http.build();
}

Chốt 3: Mở cửa cho WebSocket / WebRTC
CORS của HTTP không có tác dụng với WebSocket. Bạn phải cấu hình riêng tại nơi đăng ký Endpoint.
👉 Sửa file WebSocketConfig.java: Thêm .setAllowedOriginPatterns("*").
@Override
public void registerStompEndpoints(StompEndpointRegistry registry) {
    registry.addEndpoint("/ws", "/ws-signal")
            .setAllowedOriginPatterns("*") // Bắt buộc có dòng này
            .withSockJS();
}
Kết quả: Sau khi hoàn tất 4 bước trên, bạn có thể dùng điện thoại truy cập link Cloudflare Frontend, gọi Video Call và nhắn tin Real-time mượt mà qua mạng Internet.
```
