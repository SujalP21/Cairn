import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Login from "./Login";

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  setAccessToken: vi.fn(),
  navigate: vi.fn(),
  setCurrentUser: vi.fn(),
}));

vi.mock("../../api/client", () => ({
  default: { post: mocks.post },
  setAccessToken: mocks.setAccessToken,
}));

vi.mock("../../auth", () => ({
  useAuth: () => ({ setCurrentUser: mocks.setCurrentUser }),
}));

vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => mocks.navigate,
}));

const renderLogin = () =>
  render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  );

const signIn = async (email = "ada@example.com", password = "password123") => {
  const user = userEvent.setup();

  await user.type(screen.getByLabelText(/email/i), email);
  await user.type(screen.getByLabelText(/password/i), password);
  await user.click(screen.getByRole("button", { name: /login/i }));
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(window, "alert").mockImplementation(() => {});
});

describe("Login", () => {
  it("posts the credentials to /login", async () => {
    mocks.post.mockResolvedValue({
      data: { accessToken: "token-1", userId: "user-1" },
    });

    renderLogin();
    await signIn();

    await waitFor(() =>
      expect(mocks.post).toHaveBeenCalledWith("/login", {
        email: "ada@example.com",
        password: "password123",
      })
    );
  });

  it("stores the access token in memory and never in localStorage", async () => {
    mocks.post.mockResolvedValue({
      data: { accessToken: "token-1", userId: "user-1" },
    });

    renderLogin();
    await signIn();

    await waitFor(() =>
      expect(mocks.setAccessToken).toHaveBeenCalledWith("token-1")
    );

    expect(window.localStorage.getItem("token")).toBeNull();
    expect(window.localStorage.getItem("userId")).toBeNull();
  });

  it("navigates client-side so the in-memory token survives", async () => {
    mocks.post.mockResolvedValue({
      data: { accessToken: "token-1", userId: "user-1" },
    });

    renderLogin();
    await signIn();

    // A full page load would discard the access token held in module scope.
    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith("/", { replace: true })
    );
  });

  it("re-enables the button after a failed attempt", async () => {
    mocks.post.mockRejectedValue({
      response: { data: { error: { message: "Invalid credentials!" } } },
    });
    vi.spyOn(console, "error").mockImplementation(() => {});

    renderLogin();
    await signIn("ada@example.com", "wrongpassword");

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /login/i })).not.toBeDisabled()
    );
    expect(mocks.setAccessToken).not.toHaveBeenCalled();
  });

  it("offers a route to sign up", () => {
    renderLogin();

    expect(
      screen.getByRole("link", { name: /create an account/i })
    ).toHaveAttribute("href", "/signup");
  });
});
