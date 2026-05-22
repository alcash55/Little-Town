export function getJwtSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      if (process.env.NODE_ENV === "production") {
        throw new Error("JWT_SECRET must be set in production");
      }
      return "fallback-secret-local-only";
    }
    return secret;
  }