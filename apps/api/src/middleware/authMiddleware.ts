import type { Request, RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { loadEnv } from "../config/env";
import { UnauthorizedError } from "../lib/errors";

function readBearerToken(req: Request): string | null {
  const header = req.headers.authorization ?? "";
  const [scheme, token] = header.split(" ");

  return scheme === "Bearer" && token ? token : null;
}

function verify(token: string): { sub: string } {
  const payload = jwt.verify(token, loadEnv().JWT_ACCESS_SECRET);

  if (typeof payload === "string" || typeof payload.sub !== "string") {
    throw new UnauthorizedError("Invalid access token");
  }

  return { sub: payload.sub };
}

// Rejects the request unless a valid access token is present.
export const authenticate: RequestHandler = (req, _res, next) => {
  const token = readBearerToken(req);

  if (!token) {
    return next(new UnauthorizedError());
  }

  try {
    req.user = { id: verify(token).sub };
    return next();
  } catch (err) {
    // The client's refresh interceptor keys off this code, so it must be stable.
    if (err instanceof Error && err.name === "TokenExpiredError") {
      return next(
        new UnauthorizedError("Access token expired", "TOKEN_EXPIRED")
      );
    }

    return next(new UnauthorizedError("Invalid access token"));
  }
};

/**
 * Populates req.user when a valid token is present but never rejects. Used by
 * routes that are readable anonymously yet must know the viewer to decide
 * whether private records are visible.
 */
export const authenticateOptional: RequestHandler = (req, _res, next) => {
  const token = readBearerToken(req);

  if (token) {
    try {
      req.user = { id: verify(token).sub };
    } catch {
      // An invalid token on a public route is treated as being logged out.
    }
  }

  return next();
};
