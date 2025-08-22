import { Request, Response, NextFunction } from "express";
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
  next: NextFunction
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

  // Mongoose bad ObjectId
  if (err.name === "CastError") {
    const message = "Resource not found";
    error = new AppError(message, 404);
  }

  // Mongoose duplicate key
  if (err.name === "MongoError" && (err as any).code === 11000) {
    const message = "Duplicate field value entered";
    error = new AppError(message, 400);
  }

  // Mongoose validation error
  if (err.name === "ValidationError") {
    const message = Object.values((err as any).errors).map(
      (val: any) => val.message
    );
    error = new AppError(message.join(", "), 400);
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

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
