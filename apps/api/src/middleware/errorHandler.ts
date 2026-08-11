import type { ErrorRequestHandler, RequestHandler } from "express";
import mongoose from "mongoose";
import { AppError, NotFoundError, type ErrorDetail } from "../lib/errors";

interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: ErrorDetail[];
  };
  requestId?: string;
}

// Routed through the error handler rather than responding directly, so an
// unmatched path gets the same envelope and requestId as everything else.
export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new NotFoundError(`Cannot ${req.method} ${req.path}`));
};

/**
 * The single place an error becomes an HTTP response.
 *
 * Deliberate AppErrors are reported verbatim. Anything else is a bug: it is
 * logged in full and reported as a bare 500, so internal messages, stack traces
 * and driver details never reach a client.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  const requestId = typeof req.id === "string" ? req.id : undefined;

  if (err instanceof AppError) {
    // Client mistakes are not server problems; log them quietly.
    req.log?.warn(
      { err, code: err.code, statusCode: err.statusCode },
      "Request rejected"
    );

    const body: ErrorBody = {
      error: { code: err.code, message: err.message },
      requestId,
    };
    if (err.details) body.error.details = err.details;

    res.status(err.statusCode).json(body);
    return;
  }

  // Translate the driver's own failures into the same shape.
  if (err instanceof mongoose.Error.ValidationError) {
    const details: ErrorDetail[] = Object.values(err.errors).map((issue) => ({
      field: issue.path,
      message: issue.message,
    }));

    req.log?.warn({ err }, "Schema validation failed");
    res.status(400).json({
      error: {
        code: "VALIDATION_FAILED",
        message: "Validation failed",
        details,
      },
      requestId,
    } satisfies ErrorBody);
    return;
  }

  if (err instanceof mongoose.Error.CastError) {
    req.log?.warn({ err }, "Malformed identifier");
    res.status(400).json({
      error: { code: "INVALID_ID", message: `Malformed value for ${err.path}` },
      requestId,
    } satisfies ErrorBody);
    return;
  }

  if (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: number }).code === 11000
  ) {
    req.log?.warn({ err }, "Duplicate key");
    res.status(409).json({
      error: { code: "CONFLICT", message: "That value is already taken" },
      requestId,
    } satisfies ErrorBody);
    return;
  }

  req.log?.error({ err }, "Unhandled error");

  res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Something went wrong" },
    requestId,
  } satisfies ErrorBody);
};
