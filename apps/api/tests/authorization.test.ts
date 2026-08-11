import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { useTestDatabase } from "./helpers/db";
import {
  auth,
  createRepo,
  createUser,
  testApp,
  type TestUser,
} from "./helpers/api";

useTestDatabase();

let owner: TestUser;
let stranger: TestUser;

beforeEach(async () => {
  owner = await createUser();
  stranger = await createUser();
});

describe("authentication is required where the route table says so", () => {
  it("rejects anonymous callers on protected routes", async () => {
    const app = testApp();

    await request(app).get("/allUsers").expect(401);
    await request(app).post("/repo/create").send({ name: "x" }).expect(401);
    await request(app)
      .put("/updateProfile/" + owner.id)
      .send({})
      .expect(401);
    await request(app)
      .delete("/deleteProfile/" + owner.id)
      .expect(401);
  });

  it("allows anonymous callers on public routes", async () => {
    await request(testApp()).get("/repo/all").expect(200);
    await request(testApp()).get("/healthz").expect(200);
  });
});

describe("repository ownership", () => {
  it("takes the owner from the token, never the request body", async () => {
    // stranger tries to create a repository owned by someone else
    const created = await request(testApp())
      .post("/repo/create")
      .set(auth(stranger))
      .send({ name: "forged", owner: owner.id })
      .expect(201);

    const repo = await request(testApp())
      .get(`/repo/${created.body.repositoryID}`)
      .set(auth(stranger))
      .expect(200);

    expect(repo.body.owner._id).toBe(stranger.id);
    expect(repo.body.owner._id).not.toBe(owner.id);
  });

  it("refuses writes from a non-owner", async () => {
    const repoId = await createRepo(owner);
    const app = testApp();

    await request(app)
      .put(`/repo/update/${repoId}`)
      .set(auth(stranger))
      .send({ description: "hacked" })
      .expect(403);

    await request(app)
      .patch(`/repo/toggle/${repoId}`)
      .set(auth(stranger))
      .expect(403);

    await request(app)
      .delete(`/repo/delete/${repoId}`)
      .set(auth(stranger))
      .expect(403);
  });

  it("allows the owner to write", async () => {
    const repoId = await createRepo(owner);

    await request(testApp())
      .put(`/repo/update/${repoId}`)
      .set(auth(owner))
      .send({ description: "mine" })
      .expect(200);

    await request(testApp())
      .delete(`/repo/delete/${repoId}`)
      .set(auth(owner))
      .expect(200);
  });
});

describe("repository visibility", () => {
  it("hides a private repository from everyone but its owner", async () => {
    const repoId = await createRepo(owner, { visibility: false });

    await request(testApp())
      .get(`/repo/${repoId}`)
      .set(auth(owner))
      .expect(200);

    // 404 rather than 403: a 403 would confirm the repository exists.
    await request(testApp())
      .get(`/repo/${repoId}`)
      .set(auth(stranger))
      .expect(404);

    await request(testApp()).get(`/repo/${repoId}`).expect(404);
  });

  it("keeps private repositories out of listings", async () => {
    await createRepo(owner, { name: "secret", visibility: false });
    await createRepo(owner, { name: "open", visibility: true });

    const anonymous = await request(testApp()).get("/repo/all").expect(200);
    const names = anonymous.body.map((r: { name: string }) => r.name);

    expect(names).toContain("open");
    expect(names).not.toContain("secret");

    // The owner still sees their own private repository.
    const asOwner = await request(testApp())
      .get("/repo/all")
      .set(auth(owner))
      .expect(200);

    expect(asOwner.body.map((r: { name: string }) => r.name)).toContain(
      "secret"
    );
  });

  it("filters the per-user listing by viewer", async () => {
    await createRepo(owner, { name: "hidden", visibility: false });

    const asStranger = await request(testApp())
      .get(`/repo/user/${owner.id}`)
      .set(auth(stranger))
      .expect(200);

    expect(asStranger.body.repositories).toHaveLength(0);

    const asSelf = await request(testApp())
      .get(`/repo/user/${owner.id}`)
      .set(auth(owner))
      .expect(200);

    expect(asSelf.body.repositories).toHaveLength(1);
  });

  it("filters lookup by name", async () => {
    await createRepo(owner, { name: "byname", visibility: false });

    await request(testApp()).get("/repo/name/byname").expect(404);
    await request(testApp())
      .get("/repo/name/byname")
      .set(auth(owner))
      .expect(200);
  });
});

describe("profiles", () => {
  it("refuses edits to someone else's profile", async () => {
    await request(testApp())
      .put(`/updateProfile/${owner.id}`)
      .set(auth(stranger))
      .send({ email: "pwned@example.com" })
      .expect(403);

    await request(testApp())
      .delete(`/deleteProfile/${owner.id}`)
      .set(auth(stranger))
      .expect(403);
  });

  it("discloses email only to the account holder", async () => {
    const asStranger = await request(testApp())
      .get(`/userProfile/${owner.id}`)
      .set(auth(stranger))
      .expect(200);

    expect(asStranger.body.email).toBeUndefined();
    expect(asStranger.body.username).toBe(owner.username);

    const asSelf = await request(testApp())
      .get(`/userProfile/${owner.id}`)
      .set(auth(owner))
      .expect(200);

    expect(asSelf.body.email).toBe(owner.email);
  });

  it("never exposes the password digest on a profile", async () => {
    const response = await request(testApp())
      .get(`/userProfile/${owner.id}`)
      .set(auth(owner))
      .expect(200);

    expect(response.body.password).toBeUndefined();
  });
});

describe("issues", () => {
  it("lets any signed-in user open an issue on a readable repository", async () => {
    const repoId = await createRepo(owner, { visibility: true });

    const created = await request(testApp())
      .post(`/issue/create/${repoId}`)
      .set(auth(stranger))
      .send({ title: "found a bug", description: "it breaks" })
      .expect(201);

    expect(created.body.author).toBe(stranger.id);
  });

  it("refuses to open an issue on a repository the caller cannot see", async () => {
    const repoId = await createRepo(owner, { visibility: false });

    await request(testApp())
      .post(`/issue/create/${repoId}`)
      .set(auth(stranger))
      .send({ title: "t", description: "d" })
      .expect(404);
  });

  it("restricts issue edits to the repository owner", async () => {
    const repoId = await createRepo(owner, { visibility: true });

    const created = await request(testApp())
      .post(`/issue/create/${repoId}`)
      .set(auth(stranger))
      .send({ title: "t", description: "d" })
      .expect(201);

    const issueId = String(created.body._id);

    // Even the author cannot edit it under the current ownership model.
    await request(testApp())
      .put(`/issue/update/${issueId}`)
      .set(auth(stranger))
      .send({ status: "closed" })
      .expect(403);

    await request(testApp())
      .put(`/issue/update/${issueId}`)
      .set(auth(owner))
      .send({ status: "closed" })
      .expect(200);
  });

  it("links a new issue to its repository", async () => {
    const repoId = await createRepo(owner, { visibility: true });

    const created = await request(testApp())
      .post(`/issue/create/${repoId}`)
      .set(auth(owner))
      .send({ title: "linked", description: "d" })
      .expect(201);

    const repo = await request(testApp())
      .get(`/repo/${repoId}`)
      .set(auth(owner))
      .expect(200);

    expect(repo.body.issues).toHaveLength(1);
    expect(repo.body.issues[0]._id).toBe(String(created.body._id));
  });

  it("unlinks an issue when it is deleted", async () => {
    const repoId = await createRepo(owner, { visibility: true });

    const created = await request(testApp())
      .post(`/issue/create/${repoId}`)
      .set(auth(owner))
      .send({ title: "temp", description: "d" })
      .expect(201);

    await request(testApp())
      .delete(`/issue/delete/${String(created.body._id)}`)
      .set(auth(owner))
      .expect(200);

    const repo = await request(testApp())
      .get(`/repo/${repoId}`)
      .set(auth(owner))
      .expect(200);

    expect(repo.body.issues).toHaveLength(0);
  });

  it("hides issues belonging to a private repository", async () => {
    const repoId = await createRepo(owner, { visibility: false });

    await request(testApp())
      .post(`/issue/create/${repoId}`)
      .set(auth(owner))
      .send({ title: "private", description: "d" })
      .expect(201);

    await request(testApp()).get(`/issue/all/${repoId}`).expect(404);

    await request(testApp())
      .get(`/issue/all/${repoId}`)
      .set(auth(owner))
      .expect(200);
  });
});
