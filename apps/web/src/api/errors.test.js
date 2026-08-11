import { describe, expect, it } from "vitest";
import { getErrorMessage, getFieldErrors } from "./errors";

const apiError = (body) => ({ response: { data: body } });

describe("getErrorMessage", () => {
  it("reads the API's error envelope", () => {
    const err = apiError({
      error: { code: "UNAUTHORIZED", message: "Invalid credentials!" },
    });

    expect(getErrorMessage(err)).toBe("Invalid credentials!");
  });

  it("explains a network failure in plain language", () => {
    expect(getErrorMessage({ code: "ERR_NETWORK" })).toContain(
      "Cannot reach the server"
    );
  });

  it("falls back for a response that is not ours", () => {
    expect(getErrorMessage({ message: "boom" })).toBe("boom");
    expect(getErrorMessage({}, "fallback text")).toBe("fallback text");
  });

  it("never returns undefined", () => {
    expect(getErrorMessage(undefined)).toBeTypeOf("string");
    expect(getErrorMessage(null)).toBeTypeOf("string");
  });
});

describe("getFieldErrors", () => {
  it("maps validation details to bare field names", () => {
    const err = apiError({
      error: {
        code: "VALIDATION_FAILED",
        message: "Validation failed",
        details: [
          { field: "body.email", message: "must be a valid email address" },
          { field: "body.password", message: "must be at least 8 characters" },
        ],
      },
    });

    // "body." is an API-side concern; forms key on the field name.
    expect(getFieldErrors(err)).toEqual({
      email: "must be a valid email address",
      password: "must be at least 8 characters",
    });
  });

  it("strips params and query prefixes too", () => {
    const err = apiError({
      error: { details: [{ field: "params.id", message: "bad id" }] },
    });

    expect(getFieldErrors(err)).toEqual({ id: "bad id" });
  });

  it("returns an empty object when the failure was not a validation error", () => {
    expect(getFieldErrors(apiError({ error: { message: "nope" } }))).toEqual(
      {}
    );
    expect(getFieldErrors(undefined)).toEqual({});
  });
});
