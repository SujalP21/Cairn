import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// axios is mocked at the module level so the client's interceptor logic can be
// exercised without a server. The instance returned by axios.create is a
// callable stub, because the response interceptor retries by calling it.
const handlers = { request: null, response: null, responseError: null };

const instance = vi.fn();
instance.interceptors = {
  request: { use: vi.fn((fn) => (handlers.request = fn)) },
  response: {
    use: vi.fn((ok, err) => {
      handlers.response = ok;
      handlers.responseError = err;
    }),
  },
};
instance.post = vi.fn();

vi.mock("axios", () => ({
  default: {
    create: () => instance,
    post: vi.fn(),
  },
}));

let axios;
let client;

beforeEach(async () => {
  vi.resetModules();
  axios = (await import("axios")).default;
  client = await import("./client");
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("access token handling", () => {
  it("keeps the token in memory, never in localStorage", () => {
    client.setAccessToken("secret-token");

    expect(client.getAccessToken()).toBe("secret-token");
    expect(window.localStorage.getItem("token")).toBeNull();
    expect(JSON.stringify(window.localStorage)).not.toContain("secret-token");
  });

  it("attaches the token as a Bearer header when set", () => {
    client.setAccessToken("abc123");

    const config = handlers.request({ headers: {} });

    expect(config.headers.Authorization).toBe("Bearer abc123");
  });

  it("sends no Authorization header when signed out", () => {
    client.setAccessToken(null);

    const config = handlers.request({ headers: {} });

    expect(config.headers.Authorization).toBeUndefined();
  });
});

describe("session bootstrap", () => {
  it("restores a session from the refresh cookie", async () => {
    axios.post.mockResolvedValueOnce({
      data: { accessToken: "fresh", userId: "u1" },
    });

    const session = await client.bootstrapSession();

    expect(session.userId).toBe("u1");
    expect(client.getAccessToken()).toBe("fresh");
  });

  it("resolves to null rather than throwing when there is no session", async () => {
    axios.post.mockRejectedValueOnce(new Error("401"));

    await expect(client.bootstrapSession()).resolves.toBeNull();
    expect(client.getAccessToken()).toBeNull();
  });

  it("sends the CSRF client header when refreshing", async () => {
    axios.post.mockResolvedValueOnce({ data: { accessToken: "t" } });

    await client.refreshSession();

    const [, , config] = axios.post.mock.calls[0];
    expect(config.headers["X-Cairn-Client"]).toBe("web");
    expect(config.withCredentials).toBe(true);
  });

  it("shares one in-flight refresh between concurrent callers", async () => {
    let resolve;
    axios.post.mockReturnValueOnce(
      new Promise((r) => {
        resolve = r;
      })
    );

    const first = client.refreshSession();
    const second = client.refreshSession();

    resolve({ data: { accessToken: "shared" } });
    await Promise.all([first, second]);

    // Two callers, one network call — otherwise rotation would invalidate the
    // winner and log the user out.
    expect(axios.post).toHaveBeenCalledTimes(1);
  });
});

describe("401 handling", () => {
  const unauthorized = (url = "/repo/all") => ({
    response: { status: 401 },
    config: { url, headers: {} },
  });

  it("refreshes once and retries the original request", async () => {
    axios.post.mockResolvedValueOnce({ data: { accessToken: "renewed" } });
    instance.mockResolvedValueOnce({ data: "retried" });

    const result = await handlers.responseError(unauthorized());

    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(result.data).toBe("retried");
  });

  it("does not retry the refresh call itself", async () => {
    await expect(
      handlers.responseError(unauthorized("/refresh"))
    ).rejects.toBeDefined();

    expect(axios.post).not.toHaveBeenCalled();
  });

  it("does not retry the same request twice", async () => {
    const error = unauthorized();
    error.config._retried = true;

    await expect(handlers.responseError(error)).rejects.toBeDefined();
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("clears the token and notifies when the refresh fails", async () => {
    client.setAccessToken("stale");
    axios.post.mockRejectedValueOnce(new Error("refresh failed"));

    const onExpired = vi.fn();
    client.setOnSessionExpired(onExpired);

    await expect(handlers.responseError(unauthorized())).rejects.toBeDefined();

    expect(client.getAccessToken()).toBeNull();
    expect(onExpired).toHaveBeenCalledOnce();
  });

  it("passes non-401 errors straight through", async () => {
    const error = { response: { status: 500 }, config: { url: "/x" } };

    await expect(handlers.responseError(error)).rejects.toBe(error);
    expect(axios.post).not.toHaveBeenCalled();
  });
});
