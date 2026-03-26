function normalizeBase(base: string) {
  return base.replace(/\/+$/, "");
}

function normalizeWebSocketUrl(value: string, defaultPath: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const withWsProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed.replace(/^http/i, "ws")
    : trimmed;

  // Support absolute ws(s) URL first.
  if (/^wss?:\/\//i.test(withWsProtocol)) {
    try {
      const parsed = new URL(withWsProtocol);
      if (!parsed.pathname || parsed.pathname === "/") {
        parsed.pathname = defaultPath;
      }
      return parsed.toString();
    } catch {
      return withWsProtocol;
    }
  }

  // Support relative path style values like "/ws-signal".
  if (withWsProtocol.startsWith("/")) {
    return `${resolveApiBaseUrl().replace(/^http/i, "ws")}${withWsProtocol}`;
  }

  return withWsProtocol;
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
    const result = normalizeWebSocketUrl(configured, defaultPath);
    console.log("[runtimeApi] Resolved WebSocket URL from VITE_WEBRTC_WS_URL:", result);
    return result;
  }

  // Fallback to absolute backend ws URL only.
  const fallback = `${resolveApiBaseUrl().replace(/^http/i, "ws")}${defaultPath}`;
  console.log("[runtimeApi] Fallback WebSocket URL:", fallback);
  return fallback;
}
