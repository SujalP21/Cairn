import request from "supertest";
import type { Express } from "express";
import { createApp } from "../../src/app";

export const CLIENT_HEADER = { "X-Cairn-Client": "web" } as const;

let app: Express | null = null;

// One app instance per test file; it holds no per-request state.
export function testApp(): Express {
  app ??= createApp();
  return app;
}

export interface TestUser {
  id: string;
  username: string;
  email: string;
  password: string;
  accessToken: string;
  refreshCookie: string;
}

let counter = 0;

/**
 * Registers a fresh user and returns their credentials plus tokens.
 *
 * Usernames are unique per call so the unique index does not make tests
 * order-dependent.
 */
export async function createUser(
  overrides: Partial<{ username: string; email: string; password: string }> = {}
): Promise<TestUser> {
  counter += 1;

  const username = overrides.username ?? `user${counter}`;
  const email = overrides.email ?? `user${counter}@example.com`;
  const password = overrides.password ?? "password123";

  const response = await request(testApp())
    .post("/signup")
    .send({ username, email, password })
    .expect(201);

  const setCookie = response.headers["set-cookie"];
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie ?? ""];

  return {
    id: String(response.body.userId),
    username,
    email,
    password,
    accessToken: String(response.body.accessToken),
    refreshCookie: cookies.find((c) => c.startsWith("cairn_refresh=")) ?? "",
  };
}

export const auth = (user: TestUser) => ({
  Authorization: `Bearer ${user.accessToken}`,
});

/** Creates a repository owned by `user` and returns its id. */
export async function createRepo(
  user: TestUser,
  body: Partial<{ name: string; description: string; visibility: boolean }> = {}
): Promise<string> {
  counter += 1;

  const response = await request(testApp())
    .post("/repo/create")
    .set(auth(user))
    .send({ name: body.name ?? `repo${counter}`, ...body })
    .expect(201);

  return String(response.body.repositoryID);
}
