import { describe, expect, it } from "vitest";
import request from "supertest";
import { useTestDatabase } from "./helpers/db";
import { auth, createRepo, createUser, testApp } from "./helpers/api";

useTestDatabase();

describe("request validation", () => {
  it("reports every invalid field at once, with paths", async () => {
    const response = await request(testApp())
      .post("/signup")
      .send({ username: "a", email: "not-an-email", password: "short" })
      .expect(400);

    expect(response.body.error.code).toBe("VALIDATION_FAILED");

    const fields = response.body.error.details.map(
      (d: { field: string }) => d.field
    );

    expect(fields).toEqual(
      expect.arrayContaining(["body.username", "body.email", "body.password"])
    );
  });

  it("rejects a malformed ObjectId in the path", async () => {
    const response = await request(testApp())
      .get("/repo/not-an-object-id")
      .expect(400);

    expect(response.body.error.details[0].field).toBe("params.id");
  });

  it("strips unknown keys instead of persisting them", async () => {
    const response = await request(testApp())
      .post("/signup")
      .send({
        username: "escalate",
        email: "escalate@example.com",
        password: "password123",
        isAdmin: true,
        role: "superuser",
      })
      .expect(201);

    const profile = await request(testApp())
      .get(`/userProfile/${String(response.body.userId)}`)
      .set("Authorization", `Bearer ${String(response.body.accessToken)}`)
      .expect(200);

    expect(profile.body.isAdmin).toBeUndefined();
    expect(profile.body.role).toBeUndefined();
  });

  it("normalises input before storing it", async () => {
    const response = await request(testApp())
      .post("/signup")
      .send({
        username: "  spaced  ",
        email: "  MiXeD@Example.COM  ",
        password: "password123",
      })
      .expect(201);

    const profile = await request(testApp())
      .get(`/userProfile/${String(response.body.userId)}`)
      .set("Authorization", `Bearer ${String(response.body.accessToken)}`)
      .expect(200);

    expect(profile.body.username).toBe("spaced");
    expect(profile.body.email).toBe("mixed@example.com");
  });

  it("rejects usernames that violate the shared rule", async () => {
    for (const username of ["has space", "-leading", "trailing-", "sym$bol"]) {
      await request(testApp())
        .post("/signup")
        .send({
          username,
          email: `${Date.now()}@example.com`,
          password: "password123",
        })
        .expect(400);
    }
  });

  it("requires at least one field on a partial update", async () => {
    const user = await createUser();

    await request(testApp())
      .put(`/updateProfile/${user.id}`)
      .set(auth(user))
      .send({})
      .expect(400);
  });

  it("does not blank out required issue fields on a partial update", async () => {
    const user = await createUser();
    const repoId = await createRepo(user, { visibility: true });

    const created = await request(testApp())
      .post(`/issue/create/${repoId}`)
      .set(auth(user))
      .send({ title: "original", description: "original description" })
      .expect(201);

    const updated = await request(testApp())
      .put(`/issue/update/${String(created.body._id)}`)
      .set(auth(user))
      .send({ status: "closed" })
      .expect(200);

    expect(updated.body.issue.title).toBe("original");
    expect(updated.body.issue.description).toBe("original description");
    expect(updated.body.issue.status).toBe("closed");
  });

  it("rejects an issue status outside the shared enum", async () => {
    const user = await createUser();
    const repoId = await createRepo(user, { visibility: true });

    const created = await request(testApp())
      .post(`/issue/create/${repoId}`)
      .set(auth(user))
      .send({ title: "t", description: "d" })
      .expect(201);

    await request(testApp())
      .put(`/issue/update/${String(created.body._id)}`)
      .set(auth(user))
      .send({ status: "banana" })
      .expect(400);
  });
});

describe("error envelope", () => {
  it("uses one shape for every failure", async () => {
    const responses = await Promise.all([
      request(testApp()).get("/no/such/route"),
      request(testApp()).get("/allUsers"),
      request(testApp()).post("/signup").send({}),
    ]);

    for (const response of responses) {
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBeTypeOf("string");
      expect(response.body.error.message).toBeTypeOf("string");
    }
  });

  it("attaches a request id that matches the response header", async () => {
    const response = await request(testApp()).get("/allUsers").expect(401);

    expect(response.body.requestId).toBe(response.headers["x-request-id"]);
  });

  it("never leaks a stack trace", async () => {
    const response = await request(testApp()).get("/no/such/route").expect(404);

    expect(JSON.stringify(response.body)).not.toContain("at ");
    expect(response.body.stack).toBeUndefined();
  });
});
