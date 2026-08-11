import { useEffect } from "react";
import { io } from "socket.io-client";
import { API_BASE_URL, getAccessToken } from "../api/client";

let socket = null;

/**
 * Opens one authenticated socket for the whole app.
 *
 * The access token is sent on the handshake, which is what the server verifies
 * before putting the connection into that user's room — the client never asks
 * to join a room by id. The token is read lazily at connect time because it
 * lives in memory and only exists after the session bootstraps.
 */
export function connectSocket() {
  const token = getAccessToken();
  if (!token || socket) return socket;

  socket = io(API_BASE_URL, {
    auth: { token },
    withCredentials: true,
    autoConnect: true,
  });

  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

/**
 * Subscribes to a server event for as long as the component is mounted.
 *
 * No-ops when signed out, so pages can call it unconditionally.
 */
export function useSocketEvent(event, handler, { enabled = true } = {}) {
  useEffect(() => {
    if (!enabled) return undefined;

    const connection = connectSocket();
    if (!connection) return undefined;

    connection.on(event, handler);

    return () => {
      connection.off(event, handler);
    };
  }, [event, handler, enabled]);
}
