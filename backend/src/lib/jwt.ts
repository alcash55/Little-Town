export function getJwtSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (secret) return secret;

    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET must be set in production");
    }

    if (process.env.ALLOW_DEV_AUTH === "true") {
      return "fallback-secret-local-only";
    }

    throw new Error(
      "JWT_SECRET must be set, or set ALLOW_DEV_AUTH=true to use the local dev fallback secret",
    );
  }