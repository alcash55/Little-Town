/**
 * Direct unit coverage for errorHandler's Postgres-code-to-message mapping.
 * The 23505 (unique violation) branch is the one that reaches a real person
 * mid-signup, most often via the accept_invite RPC on a duplicate username
 * (see backend/src/db/invites.ts) — issue #86 rewrote its message from the
 * raw "username already exists" to a sentence someone would actually say.
 */
import { describe, expect, test } from "bun:test";
import type { Request, Response } from "express";

import { errorHandler } from "../../src/middleware/errorHandler.js";

/** A response stand-in that records the status/body errorHandler sends. */
function fakeResponse(): Response & { statusCode?: number; body?: unknown } {
  const res: Partial<Response> & { statusCode?: number; body?: unknown } = {};
  res.status = ((code: number) => {
    res.statusCode = code;
    return res as Response;
  }) as Response["status"];
  res.json = ((payload: unknown) => {
    res.body = payload;
    return res as Response;
  }) as Response["json"];
  return res as Response & { statusCode?: number; body?: unknown };
}

const fakeRequest = { url: "/api/invites/some-token/accept", method: "POST" } as Request;

function postgresError(code: string, detail: string): Error {
  const err = new Error("duplicate key value violates unique constraint") as Error & {
    code: string;
    detail: string;
  };
  err.code = code;
  err.detail = detail;
  return err;
}

describe("errorHandler — 23505 unique violation (#86)", () => {
  test("a duplicate username reads as a sentence a person would say, not the raw column name", () => {
    const res = fakeResponse();
    errorHandler(
      postgresError("23505", "Key (username)=(bob) already exists."),
      fakeRequest,
      res,
      () => undefined,
    );

    expect(res.statusCode).toBe(400);
    expect((res.body as { error: string }).error).toBe("That username is already taken.");
    expect((res.body as { code: string }).code).toBe("DUPLICATE_KEY");
  });

  test("a missing detail string falls back to a generic value, never throws", () => {
    const res = fakeResponse();
    errorHandler(postgresError("23505", ""), fakeRequest, res, () => undefined);

    expect(res.statusCode).toBe(400);
    expect((res.body as { error: string }).error).toBe("That value is already taken.");
  });
});
