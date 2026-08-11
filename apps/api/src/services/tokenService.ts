import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import type { CookieOptions } from "express";
import type { Types } from "mongoose";
import RefreshToken from "../models/refreshTokenModel";
import { loadEnv } from "../config/env";

export const REFRESH_COOKIE_NAME = "cairn_refresh";

type UserId = Types.ObjectId | string;

export interface IssuedToken {
  token: string;
  expiresAt: Date;
}

export type RotationResult =
  | { ok: true; userId: Types.ObjectId; token: string; expiresAt: Date }
  | { ok: false; reason: "unknown" | "reused" | "expired" };

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function signAccessToken(userId: UserId): string {
  const env = loadEnv();

  return jwt.sign({ sub: String(userId) }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL as jwt.SignOptions["expiresIn"],
  });
}

// Issues an opaque refresh token and records its digest.
export async function issueRefreshToken(userId: UserId): Promise<IssuedToken> {
  const env = loadEnv();
  const token = crypto.randomBytes(48).toString("hex");
  const expiresAt = new Date(
    Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000
  );

  await RefreshToken.create({
    user: userId,
    tokenHash: hashToken(token),
    expiresAt,
  });

  return { token, expiresAt };
}

/**
 * Validates a presented refresh token and rotates it.
 *
 * If a token that has already been revoked is presented, we treat it as a
 * replay of a stolen token and revoke every session for that user rather than
 * just rejecting the request.
 */
export async function rotateRefreshToken(
  presentedToken: string
): Promise<RotationResult> {
  const stored = await RefreshToken.findOne({
    tokenHash: hashToken(presentedToken),
  });

  if (!stored) {
    return { ok: false, reason: "unknown" };
  }

  if (stored.revokedAt) {
    await RefreshToken.updateMany(
      { user: stored.user, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );
    return { ok: false, reason: "reused" };
  }

  if (stored.expiresAt.getTime() < Date.now()) {
    return { ok: false, reason: "expired" };
  }

  stored.revokedAt = new Date();
  await stored.save();

  const next = await issueRefreshToken(stored.user);

  return { ok: true, userId: stored.user, ...next };
}

export async function revokeRefreshToken(
  presentedToken: string
): Promise<void> {
  await RefreshToken.updateOne(
    { tokenHash: hashToken(presentedToken), revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
}

// SameSite=strict would drop the cookie when the API and web app sit on
// different hosts in production, so we use lax locally and none in production
// alongside the CORS allowlist and the CSRF client header.
export function refreshCookieOptions(expiresAt: Date): CookieOptions {
  const env = loadEnv();

  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: env.isProduction ? "none" : "lax",
    expires: expiresAt,
    path: "/",
  };
}
