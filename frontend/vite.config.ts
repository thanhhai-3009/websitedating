import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8080",
        changeOrigin: true,
      },
      "/ws": {
        target: "http://127.0.0.1:8080",
        changeOrigin: true,
        ws: true,
      },
      "/ws-signal": {
        target: "http://127.0.0.1:8080",
        changeOrigin: true,
        ws: true,
      },
      "/uploads": {
        target: "http://127.0.0.1:8080",
        changeOrigin: true,
      },
    },
  },
});
