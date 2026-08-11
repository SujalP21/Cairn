import axios from "axios";

// Single source of truth for where the API lives. Configure via VITE_API_BASE_URL
// (see .env.example); the fallback keeps a fresh clone working out of the box.
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3002";

// The access token lives in module scope, never in localStorage or a readable
// cookie, so an XSS payload cannot exfiltrate it by reading storage. It is lost
// on reload by design — bootstrapSession() trades the httpOnly refresh cookie
// for a fresh one.
let accessToken = null;
let onSessionExpired = null;

export const getAccessToken = () => accessToken;
export const setAccessToken = (token) => {
  accessToken = token;
};
export const setOnSessionExpired = (handler) => {
  onSessionExpired = handler;
};

// Sent on the two cookie-authenticated endpoints. Being non-standard, it forces
// a CORS preflight that untrusted origins cannot pass — see csrfMiddleware.js.
const CLIENT_HEADER = { "X-Cairn-Client": "web" };

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // send the refresh cookie
});

apiClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  return config;
});

// Concurrent 401s must not each fire their own refresh, or token rotation would
// invalidate the winner and log the user out. They all await one in-flight call.
let refreshPromise = null;

export function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(
        `${API_BASE_URL}/refresh`,
        {},
        { withCredentials: true, headers: CLIENT_HEADER }
      )
      .then((response) => {
        setAccessToken(response.data.accessToken);
        return response.data;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

// Called once at startup to restore a session across a page reload.
export async function bootstrapSession() {
  try {
    return await refreshSession();
  } catch {
    setAccessToken(null);
    return null;
  }
}

export async function endSession() {
  try {
    await apiClient.post("/logout", {}, { headers: CLIENT_HEADER });
  } finally {
    setAccessToken(null);
  }
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const isAuthError = error.response?.status === 401;
    const isRefreshCall = original?.url === "/refresh";

    if (!isAuthError || isRefreshCall || original?._retried) {
      throw error;
    }

    original._retried = true;

    try {
      await refreshSession();
      return await apiClient(original);
    } catch {
      setAccessToken(null);
      onSessionExpired?.();
      throw error;
    }
  }
);

export default apiClient;
