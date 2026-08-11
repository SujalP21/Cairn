import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import CreateRepository from "./CreateRepository";

const mocks = vi.hoisted(() => ({ post: vi.fn(), navigate: vi.fn() }));

vi.mock("../../api/client", () => ({ default: { post: mocks.post } }));

vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => mocks.navigate,
}));

const renderPage = () =>
  render(
    <MemoryRouter>
      <CreateRepository />
    </MemoryRouter>
  );

beforeEach(() => vi.clearAllMocks());

describe("CreateRepository", () => {
  it("validates against the shared schema before calling the API", async () => {
    const user = userEvent.setup();
    renderPage();

    // Spaces are not allowed by the shared repoName rule.
    await user.type(screen.getByLabelText(/repository name/i), "not valid!");
    await user.click(
      screen.getByRole("button", { name: /create repository/i })
    );

    expect(
      await screen.findByText(/may only contain letters, numbers/i)
    ).toBeInTheDocument();

    // The request is never sent — the client rejects it first.
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it("requires a name", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(
      screen.getByRole("button", { name: /create repository/i })
    );

    expect(await screen.findByText(/is required/i)).toBeInTheDocument();
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it("clears a field error as soon as the user edits it", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(
      screen.getByRole("button", { name: /create repository/i })
    );
    expect(await screen.findByText(/is required/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/repository name/i), "valid-name");

    await waitFor(() =>
      expect(screen.queryByText(/is required/i)).not.toBeInTheDocument()
    );
  });

  it("creates a public repository by default and navigates to it", async () => {
    mocks.post.mockResolvedValue({ data: { repositoryID: "repo-1" } });

    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/repository name/i), "my-project");
    await user.type(screen.getByLabelText(/description/i), "does things");
    await user.click(
      screen.getByRole("button", { name: /create repository/i })
    );

    await waitFor(() =>
      expect(mocks.post).toHaveBeenCalledWith("/repo/create", {
        name: "my-project",
        description: "does things",
        visibility: true,
      })
    );

    expect(mocks.navigate).toHaveBeenCalledWith("/repo/repo-1", {
      replace: true,
    });
  });

  it("sends visibility false when private is chosen", async () => {
    mocks.post.mockResolvedValue({ data: { repositoryID: "repo-2" } });

    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/repository name/i), "secret-thing");
    await user.click(screen.getByRole("radio", { name: /private/i }));
    await user.click(
      screen.getByRole("button", { name: /create repository/i })
    );

    await waitFor(() =>
      expect(mocks.post).toHaveBeenCalledWith(
        "/repo/create",
        expect.objectContaining({ visibility: false })
      )
    );
  });

  it("surfaces a server-side field error on the field itself", async () => {
    // The duplicate-name rule only the API can enforce.
    mocks.post.mockRejectedValue({
      response: {
        data: {
          error: {
            code: "VALIDATION_FAILED",
            message: "Validation failed",
            details: [{ field: "body.name", message: "already taken" }],
          },
        },
      },
    });

    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/repository name/i), "taken-name");
    await user.click(
      screen.getByRole("button", { name: /create repository/i })
    );

    expect(await screen.findByText("already taken")).toBeInTheDocument();
  });

  it("shows a form-level error when the failure is not field-specific", async () => {
    mocks.post.mockRejectedValue({
      response: {
        data: { error: { code: "CONFLICT", message: "Something conflicted" } },
      },
    });

    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/repository name/i), "fine-name");
    await user.click(
      screen.getByRole("button", { name: /create repository/i })
    );

    expect(await screen.findByText("Something conflicted")).toBeInTheDocument();
  });
});
