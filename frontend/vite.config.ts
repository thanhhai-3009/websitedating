import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /^@\//,
        replacement: `${path.resolve(__dirname, "./src")}/`,
      },
      {
        find: "@clerk/shared/react",
        replacement: path.resolve(__dirname, "./node_modules/@clerk/shared/dist/runtime/react/index.js"),
      },
      {
        find: "@clerk/shared/utils",
        replacement: path.resolve(__dirname, "./node_modules/@clerk/shared/dist/runtime/utils/index.js"),
      },
      {
        find: "@clerk/shared/dom",
        replacement: path.resolve(__dirname, "./node_modules/@clerk/shared/dist/runtime/dom/index.js"),
      },
      {
        find: "@clerk/shared/workerTimers",
        replacement: path.resolve(__dirname, "./node_modules/@clerk/shared/dist/runtime/workerTimers/index.js"),
      },
      {
        find: "@clerk/shared/types",
        replacement: path.resolve(__dirname, "./node_modules/@clerk/shared/dist/types/index.js"),
      },
      {
        find: /^@clerk\/shared\/(.+)$/,
        replacement: path.resolve(__dirname, "./node_modules/@clerk/shared/dist/runtime/$1.js"),
      },
      {
        find: "@clerk/shared",
        replacement: path.resolve(__dirname, "./node_modules/@clerk/shared/dist/runtime/index.mjs"),
      },
    ],
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
});
