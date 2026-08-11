import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { useAuth } from "./useAuth";
import { AuthProvider } from "./AuthProvider";

const mocks = vi.hoisted(() => ({
  bootstrapSession: vi.fn(),
  endSession: vi.fn(),
  setOnSessionExpired: vi.fn(),
}));

vi.mock("../api/client", () => mocks);

// Minimal consumer so the tests assert on context values, not on page markup.
const Probe = () => {
  const { currentUser, isBootstrapping, logout } = useAuth();

  return (
    <div>
      <span data-testid="user">{currentUser ?? "anonymous"}</span>
      <span data-testid="bootstrapping">{String(isBootstrapping)}</span>
      <button onClick={() => void logout()}>log out</button>
    </div>
  );
};

const renderWithProvider = () =>
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>
  );

beforeEach(() => {
  mocks.bootstrapSession.mockReset();
  mocks.endSession.mockReset();
  mocks.setOnSessionExpired.mockReset();
});

describe("useAuth", () => {
  it("throws a useful error when used outside a provider", () => {
    // React logs the error boundary trace; silence it for this expected throw.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => render(<Probe />)).toThrow(
      /must be used inside an <AuthProvider>/
    );

    spy.mockRestore();
  });
});

describe("session bootstrap", () => {
  it("reports bootstrapping until the refresh attempt settles", async () => {
    let settle;
    mocks.bootstrapSession.mockReturnValue(
      new Promise((resolve) => {
        settle = resolve;
      })
    );

    renderWithProvider();

    // This is what stops a signed-in user being bounced to /auth on reload.
    expect(screen.getByTestId("bootstrapping")).toHaveTextContent("true");

    await act(async () => {
      settle({ userId: "user-1" });
    });

    await waitFor(() =>
      expect(screen.getByTestId("bootstrapping")).toHaveTextContent("false")
    );
  });

  it("signs the user in when a refresh cookie is present", async () => {
    mocks.bootstrapSession.mockResolvedValue({ userId: "user-1" });

    renderWithProvider();

    await waitFor(() =>
      expect(screen.getByTestId("user")).toHaveTextContent("user-1")
    );
  });

  it("stays anonymous when there is no session", async () => {
    mocks.bootstrapSession.mockResolvedValue(null);

    renderWithProvider();

    await waitFor(() =>
      expect(screen.getByTestId("bootstrapping")).toHaveTextContent("false")
    );
    expect(screen.getByTestId("user")).toHaveTextContent("anonymous");
  });
});

describe("logout", () => {
  it("ends the session and clears the user", async () => {
    mocks.bootstrapSession.mockResolvedValue({ userId: "user-1" });
    mocks.endSession.mockResolvedValue(undefined);

    renderWithProvider();

    await waitFor(() =>
      expect(screen.getByTestId("user")).toHaveTextContent("user-1")
    );

    await act(async () => {
      screen.getByRole("button", { name: "log out" }).click();
    });

    await waitFor(() =>
      expect(screen.getByTestId("user")).toHaveTextContent("anonymous")
    );
    expect(mocks.endSession).toHaveBeenCalledOnce();
  });
});

describe("expiry callback", () => {
  it("clears the user when the client reports the session expired", async () => {
    mocks.bootstrapSession.mockResolvedValue({ userId: "user-1" });

    renderWithProvider();

    await waitFor(() =>
      expect(screen.getByTestId("user")).toHaveTextContent("user-1")
    );

    // The api client hands the provider a callback for unrecoverable 401s.
    const onExpired = mocks.setOnSessionExpired.mock.calls[0][0];
    act(() => {
      onExpired();
    });

    await waitFor(() =>
      expect(screen.getByTestId("user")).toHaveTextContent("anonymous")
    );
  });
});
