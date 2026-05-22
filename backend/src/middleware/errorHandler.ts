import { Request, Response, NextFunction, RequestHandler } from "express";

import { ErrorResponse } from "../types/index.js";

export class AppError extends Error {
  public statusCode: number;
  public code?: string;

  constructor(message: string, statusCode: number, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  let error = { ...err };
  error.message = err.message;

  // Log error for debugging
  console.error("Error:", {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    query: req.query,
  });

  // Supabase/Postgres unique constraint violation (e.g. duplicate username/email)
  if ((err as any).code === "23505") {
    const detail = (err as any).detail || "";
    const field = detail.match(/\(([^)]+)\)/)?.[1] ?? "field";
    error = new AppError(`${field} already exists`, 400, "DUPLICATE_KEY");
  }

  // Supabase/Postgres foreign key violation (e.g. referencing a non-existent bingo/user)
  if ((err as any).code === "23503") {
    error = new AppError(
      "Referenced resource not found",
      400,
      "FOREIGN_KEY_VIOLATION",
    );
  }

  // Supabase/Postgres not null violation (e.g. missing required field)
  if ((err as any).code === "23502") {
    const column = (err as any).column ?? "field";
    error = new AppError(`${column} is required`, 400, "NOT_NULL_VIOLATION");
  }

  // Supabase/Postgres check constraint violation (e.g. invalid role or status value)
  if ((err as any).code === "23514") {
    error = new AppError("Invalid value provided", 400, "CHECK_VIOLATION");
  }

  // Supabase row not found (maybeSingle() returns null, but .single() throws this)
  if ((err as any).code === "PGRST116") {
    error = new AppError("Resource not found", 404, "NOT_FOUND");
  }

  // Supabase auth/permission error (RLS policy blocked the query)
  if ((err as any).code === "42501") {
    error = new AppError("Insufficient permissions", 403, "FORBIDDEN");
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    const message = "Invalid token";
    error = new AppError(message, 401);
  }

  if (err.name === "TokenExpiredError") {
    const message = "Token expired";
    error = new AppError(message, 401);
  }

  const statusCode = (error as AppError).statusCode || 500;
  const message = error.message || "Server Error";

  const errorResponse: ErrorResponse = {
    error: message,
    code: (error as AppError).code,
  };

  res.status(statusCode).json(errorResponse);
};

export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>,
): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
