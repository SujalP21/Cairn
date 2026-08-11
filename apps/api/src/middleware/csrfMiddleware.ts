import type { RequestHandler } from "express";
import { ForbiddenError } from "../lib/errors";

export const CLIENT_HEADER = "x-cairn-client";

/**
 * Guards the two endpoints that authenticate with the refresh cookie alone.
 *
 * Every other route authenticates with a Bearer token, which a cross-site
 * attacker cannot set. /refresh and /logout are different: in production the
 * cookie is SameSite=None so it rides along on cross-site POSTs. Without this,
 * an attacker's page could force a token rotation — which makes the real
 * client's next refresh look like token reuse and logs the victim out of every
 * session.
 *
 * Requiring a non-standard header forces the browser to preflight the request,
 * and the CORS allowlist rejects the preflight for untrusted origins.
 */
export const requireClientHeader: RequestHandler = (req, _res, next) => {
  if (req.get(CLIENT_HEADER) !== "web") {
    return next(new ForbiddenError("Missing client header"));
  }

  return next();
};
