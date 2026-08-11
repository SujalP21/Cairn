import { describe, expect, it } from "vitest";
import request from "supertest";
import { useTestDatabase } from "./helpers/db";
import { CLIENT_HEADER, createUser, testApp } from "./helpers/api";

useTestDatabase();

const refreshCookieFrom = (headers: Record<string, unknown>): string => {
  const setCookie = headers["set-cookie"];
  const cookies = Array.isArray(setCookie) ? setCookie : [String(setCookie)];
  return cookies.find((c) => c.startsWith("cairn_refresh=")) ?? "";
};

describe("signup", () => {
  it("creates an account and returns a usable access token", async () => {
    const response = await request(testApp())
      .post("/signup")
      .send({
        username: "ada",
        email: "ada@example.com",
        password: "password123",
      })
      .expect(201);

    expect(response.body.userId).toMatch(/^[0-9a-f]{24}$/);
    expect(response.body.accessToken).toBeTypeOf("string");

    // The whole point of the insertedId fix: the id must be real, not undefined.
    await request(testApp())
      .get("/allUsers")
      .set("Authorization", `Bearer ${response.body.accessToken}`)
      .expect(200);
  });

  it("sets an httpOnly refresh cookie", async () => {
    const response = await request(testApp())
      .post("/signup")
      .send({
        username: "grace",
        email: "grace@example.com",
        password: "password123",
      })
      .expect(201);

    const cookie = refreshCookieFrom(response.headers);

    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Path=/");
  });

  it("never returns the password digest", async () => {
    const user = await createUser();

    const response = await request(testApp())
      .get("/allUsers")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(200);

    expect(JSON.stringify(response.body)).not.toContain("password");
    expect(JSON.stringify(response.body)).not.toContain("$2a$");
  });

  it("rejects a duplicate username or email", async () => {
    await createUser({ username: "taken", email: "taken@example.com" });

    await request(testApp())
      .post("/signup")
      .send({
        username: "taken",
        email: "different@example.com",
        password: "password123",
      })
      .expect(409);

    await request(testApp())
      .post("/signup")
      .send({
        username: "different",
        email: "taken@example.com",
        password: "password123",
      })
      .expect(409);
  });
});

describe("login", () => {
  it("accepts correct credentials", async () => {
    const user = await createUser();

    const response = await request(testApp())
      .post("/login")
      .send({ email: user.email, password: user.password })
      .expect(200);

    expect(response.body.userId).toBe(user.id);
  });

  it("rejects a wrong password without revealing which field was wrong", async () => {
    const user = await createUser();

    const response = await request(testApp())
      .post("/login")
      .send({ email: user.email, password: "wrongpassword" })
      .expect(401);

    expect(response.body.error.message).toBe("Invalid credentials!");
  });

  it("gives the same answer for an unknown email", async () => {
    const response = await request(testApp())
      .post("/login")
      .send({ email: "nobody@example.com", password: "password123" })
      .expect(401);

    expect(response.body.error.message).toBe("Invalid credentials!");
  });
});

describe("refresh token rotation", () => {
  it("exchanges the cookie for a new access token and rotates the cookie", async () => {
    const user = await createUser();

    const response = await request(testApp())
      .post("/refresh")
      .set(CLIENT_HEADER)
      .set("Cookie", user.refreshCookie)
      .expect(200);

    expect(response.body.accessToken).toBeTypeOf("string");
    expect(refreshCookieFrom(response.headers)).not.toBe(user.refreshCookie);
  });

  it("revokes every session when a spent token is replayed", async () => {
    const user = await createUser();

    const rotated = await request(testApp())
      .post("/refresh")
      .set(CLIENT_HEADER)
      .set("Cookie", user.refreshCookie)
      .expect(200);

    const newCookie = refreshCookieFrom(rotated.headers);

    // Replaying the spent token looks like theft.
    const replay = await request(testApp())
      .post("/refresh")
      .set(CLIENT_HEADER)
      .set("Cookie", user.refreshCookie)
      .expect(401);

    expect(replay.body.error.message).toContain("reuse detected");

    // ...so the token that legitimately replaced it dies too.
    await request(testApp())
      .post("/refresh")
      .set(CLIENT_HEADER)
      .set("Cookie", newCookie)
      .expect(401);
  });

  it("rejects an unknown refresh token", async () => {
    await request(testApp())
      .post("/refresh")
      .set(CLIENT_HEADER)
      .set("Cookie", `cairn_refresh=${"0".repeat(96)}`)
      .expect(401);
  });

  it("rejects a request with no cookie at all", async () => {
    await request(testApp()).post("/refresh").set(CLIENT_HEADER).expect(401);
  });
});

describe("logout", () => {
  it("revokes the presented refresh token", async () => {
    const user = await createUser();

    await request(testApp())
      .post("/logout")
      .set(CLIENT_HEADER)
      .set("Cookie", user.refreshCookie)
      .expect(200);

    await request(testApp())
      .post("/refresh")
      .set(CLIENT_HEADER)
      .set("Cookie", user.refreshCookie)
      .expect(401);
  });
});

describe("CSRF guard on cookie-authenticated routes", () => {
  it("rejects /refresh without the client header", async () => {
    const user = await createUser();

    await request(testApp())
      .post("/refresh")
      .set("Cookie", user.refreshCookie)
      .expect(403);
  });

  it("rejects /logout without the client header", async () => {
    const user = await createUser();

    await request(testApp())
      .post("/logout")
      .set("Cookie", user.refreshCookie)
      .expect(403);
  });
});

describe("access tokens", () => {
  it("rejects a malformed token", async () => {
    await request(testApp())
      .get("/allUsers")
      .set("Authorization", "Bearer not-a-jwt")
      .expect(401);
  });

  it("rejects a token signed with the wrong secret", async () => {
    // Signed with a different key; the signature must not verify.
    const forged =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
      "eyJzdWIiOiI2NmE3YWNiMzAzNjY4OTRmZTIwMjI3NmMifQ." +
      "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";

    await request(testApp())
      .get("/allUsers")
      .set("Authorization", `Bearer ${forged}`)
      .expect(401);
  });

  it("ignores a non-Bearer scheme", async () => {
    await request(testApp())
      .get("/allUsers")
      .set("Authorization", "Basic dXNlcjpwYXNz")
      .expect(401);
  });
});
