import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import App from "./App.tsx";
import "./index.css";
import ErrorBoundary from "./ErrorBoundary";

let publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (typeof publishableKey === "string") {
  // Remove any accidental whitespace/newlines inserted in .env
  publishableKey = publishableKey.replace(/\s+/g, "").trim();
}

const masked = (k: unknown) => {
  if (!k || typeof k !== "string") return "(none)";
  const s = k as string;
  return s.length > 8 ? `*****${s.slice(-6)}` : s;
};

// Helpful console output for debugging (masked)
console.info("Clerk publishableKey (masked):", masked(publishableKey));

if (!publishableKey) {
  // Let ErrorBoundary render a helpful message in the UI instead of throwing
  createRoot(document.getElementById("root")!).render(
    <div style={{ padding: 20, fontFamily: "Inter, Roboto, sans-serif" }}>
      <h2>Missing VITE_CLERK_PUBLISHABLE_KEY</h2>
      <p>Vui lòng đặt biến môi trường <code>VITE_CLERK_PUBLISHABLE_KEY</code> trong <code>.env</code>.</p>
    </div>
  );
} else {
  createRoot(document.getElementById("root")!).render(
    <ErrorBoundary>
      <ClerkProvider publishableKey={publishableKey}>
        <App />
      </ClerkProvider>
    </ErrorBoundary>
  );
}
