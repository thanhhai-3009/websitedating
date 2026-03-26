function normalizeBase(base: string) {
  return base.replace(/\/+$/, "");
}

export function resolveApiBaseUrl() {
  const configured = String(import.meta.env.VITE_API_BASE_URL || "").trim();
  if (configured) {
    return normalizeBase(configured);
  }

  // Fallback de tranh URL tuong doi neu env chua duoc set.
  return "http://localhost:8080";
}

export function toApiUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${resolveApiBaseUrl()}${normalizedPath}`;
}

export function resolveWebSocketUrl(defaultPath = "/ws-signal") {
  const configured = String(import.meta.env.VITE_WEBRTC_WS_URL || "").trim();
  if (configured) {
    return configured;
  }

  // Fallback to absolute backend ws URL only.
  return `${resolveApiBaseUrl().replace(/^http/i, "ws")}${defaultPath}`;
}
