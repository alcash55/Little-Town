import { afterEach, expect, test } from "bun:test";
import {
  configuredRecoveryDelivery,
  recoveryBaseUrl,
} from "../../src/services/accountRecovery.js";

const previous = {
  url: process.env.RECOVERY_DELIVERY_URL,
  secret: process.env.RECOVERY_DELIVERY_SECRET,
  frontend: process.env.FRONTEND_URL,
  mode: process.env.NODE_ENV,
};
afterEach(() => {
  for (const [key, value] of Object.entries({
    RECOVERY_DELIVERY_URL: previous.url,
    RECOVERY_DELIVERY_SECRET: previous.secret,
    FRONTEND_URL: previous.frontend,
    NODE_ENV: previous.mode,
  })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});
test("email is disabled with no relay; partial and insecure configuration fails", () => {
  delete process.env.RECOVERY_DELIVERY_URL;
  delete process.env.RECOVERY_DELIVERY_SECRET;
  expect(configuredRecoveryDelivery()).toBeUndefined();
  process.env.RECOVERY_DELIVERY_URL = "https://relay.example.test/recovery";
  expect(() => configuredRecoveryDelivery()).toThrow();
  process.env.RECOVERY_DELIVERY_SECRET = "local-test-placeholder";
  process.env.RECOVERY_DELIVERY_URL = "http://relay.example.test/recovery";
  expect(() => configuredRecoveryDelivery()).toThrow();
});
test("relay contract authenticates, refuses redirects and bounds latency without live sending", async () => {
  process.env.RECOVERY_DELIVERY_URL = "https://relay.example.test/recovery";
  process.env.RECOVERY_DELIVERY_SECRET = "local-test-placeholder";
  const requests: RequestInit[] = [];
  const deliver = configuredRecoveryDelivery(async (_url, options) => {
    requests.push(options);
    return { ok: true };
  });
  await deliver!({
    to: "local@example.test",
    url: "https://frontend.example.test/recover#token=local-fixture",
    expiresInMinutes: 60,
  });
  expect(requests[0].method).toBe("POST");
  expect(requests[0].redirect).toBe("error");
  expect(requests[0].signal).toBeInstanceOf(AbortSignal);
  expect(requests[0].headers).toEqual({
    "Content-Type": "application/json",
    Authorization: "Bearer local-test-placeholder",
  });
  expect(JSON.parse(String(requests[0].body)).expiresInMinutes).toBe(60);
  const failed = configuredRecoveryDelivery(async () => ({ ok: false }));
  await expect(
    failed!({
      to: "local@example.test",
      url: "local-fixture",
      expiresInMinutes: 60,
    })
  ).rejects.toThrow("Recovery delivery failed");
});
test("production recovery links require a trusted HTTPS frontend", () => {
  process.env.NODE_ENV = "production";
  for (const value of [
    "http://localhost:3000",
    "ftp://frontend.example.test",
    "https://user:password@frontend.example.test",
  ]) {
    process.env.FRONTEND_URL = value;
    expect(() => recoveryBaseUrl()).toThrow();
  }
  process.env.FRONTEND_URL = "https://frontend.example.test/";
  expect(recoveryBaseUrl()).toBe("https://frontend.example.test");
});
