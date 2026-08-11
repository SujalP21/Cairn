import type { RequestHandler } from "express";
import type { ZodType } from "zod";
import { ValidationError, type ErrorDetail } from "../lib/errors";

interface ValidationTargets {
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
}

/**
 * Builds middleware that validates a request against Zod schemas.
 *
 * Validated output replaces the raw input, so handlers receive trimmed,
 * coerced, stripped values — unknown keys never reach the database.
 */
export function validate(schemas: ValidationTargets): RequestHandler {
  const targets = ["body", "params", "query"] as const;

  return (req, _res, next) => {
    const errors: ErrorDetail[] = [];

    for (const key of targets) {
      const schema = schemas[key];
      if (!schema) continue;

      const result = schema.safeParse(req[key]);

      if (result.success) {
        // req.query is a getter in Express 5; assign defensively so this keeps
        // working if the runtime is upgraded.
        Object.defineProperty(req, key, {
          value: result.data,
          writable: true,
          configurable: true,
        });
      } else {
        for (const issue of result.error.issues) {
          errors.push({
            field: [key, ...issue.path].join("."),
            message: issue.message,
          });
        }
      }
    }

    if (errors.length > 0) {
      return next(new ValidationError(errors));
    }

    return next();
  };
}
