import bcrypt from "bcryptjs";
import type { Response } from "express";
import type { Types } from "mongoose";
import type {
  SignupInput,
  LoginInput,
  UpdateProfileInput,
} from "@cairn/shared";
import User from "../models/userModel";
import { asyncHandler } from "../lib/asyncHandler";
import { ConflictError, NotFoundError, UnauthorizedError } from "../lib/errors";
import {
  REFRESH_COOKIE_NAME,
  signAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  refreshCookieOptions,
} from "../services/tokenService";

const SALT_ROUNDS = 10;

async function issueSession(
  res: Response,
  userId: Types.ObjectId | string
): Promise<string> {
  const { token, expiresAt } = await issueRefreshToken(userId);

  res.cookie(REFRESH_COOKIE_NAME, token, refreshCookieOptions(expiresAt));

  return signAccessToken(userId);
}

export const signup = asyncHandler<SignupInput>(async (req, res) => {
  const { username, email, password } = req.body;

  const existing = await User.findOne({ $or: [{ username }, { email }] });
  if (existing) {
    throw new ConflictError("That username or email is already taken");
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await User.create({
    username,
    email,
    password: hashedPassword,
  });

  const accessToken = await issueSession(res, user._id);

  res.status(201).json({ accessToken, userId: user._id });
});

export const login = asyncHandler<LoginInput>(async (req, res) => {
  const { email, password } = req.body;

  // `password` is select:false on the schema, so it must be asked for.
  const user = await User.findOne({ email }).select("+password");
  if (!user) {
    throw new UnauthorizedError("Invalid credentials!");
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new UnauthorizedError("Invalid credentials!");
  }

  const accessToken = await issueSession(res, user._id);

  res.json({ accessToken, userId: user._id });
});

/**
 * Exchanges the httpOnly refresh cookie for a new access token, rotating the
 * refresh token in the process.
 */
export const refresh = asyncHandler(async (req, res) => {
  const presented: unknown = req.cookies?.[REFRESH_COOKIE_NAME];

  if (typeof presented !== "string" || !presented) {
    throw new UnauthorizedError("No refresh token provided");
  }

  const result = await rotateRefreshToken(presented);

  if (!result.ok) {
    res.clearCookie(REFRESH_COOKIE_NAME, { path: "/" });

    throw new UnauthorizedError(
      result.reason === "reused"
        ? "Refresh token reuse detected. All sessions have been revoked."
        : "Invalid or expired refresh token"
    );
  }

  res.cookie(
    REFRESH_COOKIE_NAME,
    result.token,
    refreshCookieOptions(result.expiresAt)
  );

  res.json({
    accessToken: signAccessToken(result.userId),
    userId: result.userId,
  });
});

export const logout = asyncHandler(async (req, res) => {
  const presented: unknown = req.cookies?.[REFRESH_COOKIE_NAME];

  if (typeof presented === "string" && presented) {
    await revokeRefreshToken(presented);
  }

  res.clearCookie(REFRESH_COOKIE_NAME, { path: "/" });
  res.json({ message: "Logged out" });
});

export const getAllUsers = asyncHandler(async (_req, res) => {
  // Directory listing: identity only. Email is PII and is not included.
  const users = await User.find({}).select("username createdAt");

  res.json(users);
});

export const getUserProfile = asyncHandler(async (req, res) => {
  const currentID = req.params.id;

  const user = await User.findById(currentID);

  if (!user) {
    throw new NotFoundError("User not found!");
  }

  const profile = user.toObject();

  // Email is only disclosed to the account holder.
  if (req.user?.id !== currentID) {
    delete (profile as { email?: string }).email;
  }

  res.json(profile);
});

export const updateUserProfile = asyncHandler<UpdateProfileInput>(
  async (req, res) => {
    const { email, password } = req.body;

    const updateFields: Record<string, unknown> = {};
    if (email) updateFields.email = email;
    if (password)
      updateFields.password = await bcrypt.hash(password, SALT_ROUNDS);

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      throw new NotFoundError("User not found!");
    }

    res.json(updatedUser);
  }
);

export const deleteUserProfile = asyncHandler(async (req, res) => {
  const deleted = await User.findByIdAndDelete(req.params.id);

  if (!deleted) {
    throw new NotFoundError("User not found!");
  }

  res.clearCookie(REFRESH_COOKIE_NAME, { path: "/" });
  res.json({ message: "User Profile Deleted!" });
});
