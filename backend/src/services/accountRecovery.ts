import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { getDb } from "../db/client.js";
import { hashPassword } from "../db/users.js";

export const recoveryToken = z.string().regex(/^[a-f0-9]{64}$/);
export const recoveryPassword = z
  .string()
  .min(12)
  .refine(
    (value) => Buffer.byteLength(value, "utf8") <= 72,
    "Password must fit within 72 UTF-8 bytes"
  );
export const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export type RecoveryMessage = {
  to: string;
  url: string;
  expiresInMinutes: number;
};
export type RecoveryDelivery = (message: RecoveryMessage) => Promise<void>;

// A small HTTP contract, independent of any email vendor. Never redirects credentials.
// An operator supplies their own authenticated email relay. No live sending by default.
export function configuredRecoveryDelivery(
  send: (url: string, options: RequestInit) => Promise<{ ok: boolean }> = fetch
): RecoveryDelivery | undefined {
  const endpoint = process.env.RECOVERY_DELIVERY_URL;
  const secret = process.env.RECOVERY_DELIVERY_SECRET;
  if (!endpoint && !secret) return undefined;
  if (!endpoint || !secret || new URL(endpoint).protocol !== "https:") {
    throw new Error("Recovery delivery requires an HTTPS URL and secret");
  }
  return async (message) => {
    const response = await send(endpoint, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(message),
    });
    if (!response.ok) throw new Error("Recovery delivery failed");
  };
}

export function recoveryBaseUrl(): string {
  const url = new URL(process.env.FRONTEND_URL || "http://localhost:3000");
  if (
    url.username ||
    url.password ||
    (url.protocol !== "https:" &&
      !(
        process.env.NODE_ENV !== "production" &&
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname)
      ))
  ) {
    throw new Error("Recovery requires a trusted frontend URL");
  }
  return url.origin;
}

export async function issueRecovery(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const { error } = await getDb().rpc("issue_password_reset", {
    p_user_id: userId,
    p_token_hash: digest(token),
  });
  if (error) throw new Error("Recovery storage unavailable");
  // Fragments never reach server access logs or Referer headers.
  return `${recoveryBaseUrl()}/recover#token=${token}`;
}

export async function requestRecovery(
  email: string,
  deliver: RecoveryDelivery | undefined
): Promise<void> {
  const { data: allowed, error: limitError } = await getDb().rpc(
    "take_recovery_limit",
    { p_key_hash: digest(email) }
  );
  if (limitError) throw new Error("Recovery limit storage unavailable");
  if (!allowed || !deliver) return;
  // Escape LIKE metacharacters; email comparison is case-insensitive and exact.
  const { data, error } = await getDb()
    .from("users")
    .select("id,email")
    .ilike("email", email.replace(/[\\%_]/g, "\\$&"))
    .limit(2);
  if (error) throw new Error("Recovery lookup unavailable");
  if (data?.length !== 1) return;
  const account = z.object({ id: z.guid(), email: z.email() }).parse(data[0]);
  const url = await issueRecovery(account.id);
  await deliver({ to: account.email, url, expiresInMinutes: 60 });
}

export async function recoveryStatus(token: string) {
  const { data, error } = await getDb()
    .from("password_resets")
    .select("used_at,revoked_at,expires_at")
    .eq("token_hash", digest(token))
    .maybeSingle();
  if (error) throw new Error("Recovery storage unavailable");
  if (!data) return "invalid";
  if (data.used_at) return "used";
  if (data.revoked_at) return "invalid";
  if (Date.parse(data.expires_at) <= Date.now()) return "expired";
  return "ready";
}

export async function consumeRecovery(token: string, password: string) {
  const passwordHash = await hashPassword(password);
  const { data, error } = await getDb().rpc("consume_password_reset", {
    p_token_hash: digest(token),
    p_password_hash: passwordHash,
  });
  if (error) throw new Error("Recovery storage unavailable");
  return z.enum(["complete", "used", "expired", "invalid"]).parse(data);
}
