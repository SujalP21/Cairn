import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import { useTestDatabase } from "./helpers/db";
import { testApp } from "./helpers/api";

useTestDatabase();

// The rest of the suite runs with limits disabled. These tests switch them on
// around the specific calls under test — the limiter's counters live for the
// whole file, so setup traffic has to happen while it is still skipping.
const withRateLimits = async (fn: () => Promise<void>) => {
  process.env.ENABLE_TEST_RATE_LIMIT = "1";
  try {
    await fn();
  } finally {
    delete process.env.ENABLE_TEST_RATE_LIMIT;
  }
};

afterEach(() => {
  delete process.env.ENABLE_TEST_RATE_LIMIT;
});

describe("rate limiting", () => {
  it("caps signups and answers 429 in the standard envelope", async () => {
    await withRateLimits(async () => {
      const app = testApp();
      const statuses: number[] = [];

      // The limiter allows 5 per hour.
      for (let i = 0; i < 7; i += 1) {
        const response = await request(app)
          .post("/signup")
          .send({
            username: `flood${i}`,
            email: `flood${i}@example.com`,
            password: "password123",
          });

        statuses.push(response.status);
      }

      expect(statuses.filter((s) => s === 201)).toHaveLength(5);
      expect(statuses.filter((s) => s === 429)).toHaveLength(2);

      const blocked = await request(app)
        .post("/signup")
        .send({
          username: "blocked",
          email: "blocked@example.com",
          password: "password123",
        })
        .expect(429);

      expect(blocked.body.error.code).toBe("RATE_LIMITED");
    });
  });

  it("does not count successful logins toward the auth limit", async () => {
    const app = testApp();

    // Registered with limits still off, so this does not consume the budget.
    await request(app)
      .post("/signup")
      .send({
        username: "repeat",
        email: "repeat@example.com",
        password: "password123",
      })
      .expect(201);

    await withRateLimits(async () => {
      // Well past the limit of 10, but skipSuccessfulRequests means none count.
      for (let i = 0; i < 14; i += 1) {
        await request(app)
          .post("/login")
          .send({ email: "repeat@example.com", password: "password123" })
          .expect(200);
      }
    });
  });

  it("does count failed logins", async () => {
    const app = testApp();

    await request(app)
      .post("/signup")
      .send({
        username: "victim",
        email: "victim@example.com",
        password: "password123",
      })
      .expect(201);

    await withRateLimits(async () => {
      const statuses: number[] = [];

      // 10 wrong guesses are allowed, the 11th is throttled.
      for (let i = 0; i < 12; i += 1) {
        const response = await request(app)
          .post("/login")
          .send({ email: "victim@example.com", password: "wrongpassword" });

        statuses.push(response.status);
      }

      expect(statuses.filter((s) => s === 401)).toHaveLength(10);
      expect(statuses.filter((s) => s === 429)).toHaveLength(2);
    });
  });
});
