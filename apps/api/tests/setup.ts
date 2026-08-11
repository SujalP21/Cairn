// Runs before any test module is imported.
//
// loadEnv() validates process.env at first call and exits the process if
// anything is missing, so these must be in place first. dotenv does not
// overwrite variables that already exist, which also stops a developer's local
// .env from leaking into the test run.
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
process.env.PORT = "0";

// The real connection is made by tests/helpers/db.ts against an in-memory
// mongod; this only has to satisfy the startup validation.
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/cairn_test_placeholder";

process.env.JWT_ACCESS_SECRET =
  "test-secret-that-is-at-least-thirty-two-characters-long";
process.env.ACCESS_TOKEN_TTL = "15m";
process.env.REFRESH_TOKEN_TTL_DAYS = "7";
process.env.CORS_ORIGINS = "http://localhost:5173";
