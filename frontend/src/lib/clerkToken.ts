const JWT_TEMPLATE = (import.meta.env.VITE_CLERK_JWT_TEMPLATE || "springboot").trim();

let hasMissingTemplate = false;

function isMissingTemplateError(error: unknown) {
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message?: unknown }).message || "")
      : String(error || "");

  return message.includes("No JWT template exists") || message.includes("404");
}

export async function getApiToken(
  getToken: (options?: { template?: string }) => Promise<string | null>
): Promise<string | null> {
  if (JWT_TEMPLATE && !hasMissingTemplate) {
    try {
      const templatedToken = await getToken({ template: JWT_TEMPLATE });
      if (templatedToken) {
        return templatedToken;
      }
    } catch (error) {
      if (isMissingTemplateError(error)) {
        hasMissingTemplate = true;
        console.warn(
          `[auth] Clerk JWT template '${JWT_TEMPLATE}' not found. Falling back to default getToken().`
        );
      } else {
        throw error;
      }
    }
  }

  return getToken();
}

