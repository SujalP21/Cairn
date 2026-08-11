import rateLimit from "express-rate-limit";

const message = (text: string) => ({
  error: { code: "RATE_LIMITED", message: text },
});

/**
 * Rate limits are off during tests, or the fourth test to call /signup would
 * start failing for reasons unrelated to what it asserts. The dedicated
 * rate-limit suite sets ENABLE_TEST_RATE_LIMIT=1 to switch them back on, so the
 * behaviour itself stays covered. Evaluated per request, not at module load.
 */
const skip = () =>
  process.env.NODE_ENV === "test" && process.env.ENABLE_TEST_RATE_LIMIT !== "1";

// Credential endpoints: tight, and successful calls do not count toward the
// limit so a legitimate user is never locked out by their own activity.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip,
  message: message(
    "Too many authentication attempts. Try again in 15 minutes."
  ),
});

// Signup is stricter still: it is the expensive, spam-prone one.
export const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip,
  message: message("Too many accounts created. Try again in an hour."),
});

// Broad backstop for everything else.
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip,
  message: message("Too many requests. Slow down."),
});
