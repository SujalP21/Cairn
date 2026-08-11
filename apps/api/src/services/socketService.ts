import jwt from "jsonwebtoken";
import type { Types } from "mongoose";
import type { Server, Socket } from "socket.io";
import { loadEnv } from "../config/env";
import { logger } from "../lib/logger";

interface AuthedSocket extends Socket {
  userId?: string;
}

let ioRef: Server | null = null;

const userRoom = (userId: string) => `user:${userId}`;

/**
 * Wires up the socket server.
 *
 * The handshake is authenticated with the same access token the REST API uses,
 * and room membership is derived from the verified token — a client cannot ask
 * to join a room, so it can never subscribe to another user's events.
 */
export function registerSocketHandlers(io: Server): void {
  ioRef = io;

  io.use((socket: AuthedSocket, next) => {
    const token: unknown = socket.handshake.auth?.token;

    if (typeof token !== "string" || !token) {
      return next(new Error("Authentication required"));
    }

    try {
      const payload = jwt.verify(token, loadEnv().JWT_ACCESS_SECRET);

      if (typeof payload === "string" || typeof payload.sub !== "string") {
        return next(new Error("Invalid access token"));
      }

      socket.userId = payload.sub;
      return next();
    } catch {
      return next(new Error("Invalid access token"));
    }
  });

  io.on("connection", (socket: AuthedSocket) => {
    if (socket.userId) {
      void socket.join(userRoom(socket.userId));
      logger.debug(
        { socketId: socket.id, userId: socket.userId },
        "Socket connected"
      );
    }
  });
}

// No-ops when the socket server is not running, so the CLI and tests are unaffected.
export function emitToUser(
  userId: Types.ObjectId | string | null | undefined,
  event: string,
  payload: unknown
): void {
  if (!ioRef || !userId) return;

  ioRef.to(userRoom(userId.toString())).emit(event, payload);
}
