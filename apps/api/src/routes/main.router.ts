import express from "express";
import mongoose from "mongoose";
import userRouter from "./user.router";
import repoRouter from "./repo.router";
import issueRouter from "./issue.router";

const mainRouter = express.Router();

mainRouter.use(userRouter);
mainRouter.use(repoRouter);
mainRouter.use(issueRouter);

mainRouter.get("/", (_req, res) => {
  res.send("Welcome!");
});

// Liveness: the process is up and serving.
mainRouter.get("/healthz", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

// Readiness: the process can actually serve traffic, i.e. the database is
// connected. Load balancers should gate on this one.
mainRouter.get("/readyz", (_req, res) => {
  const connected =
    mongoose.connection.readyState === mongoose.ConnectionStates.connected;

  res.status(connected ? 200 : 503).json({
    status: connected ? "ok" : "degraded",
    database: connected ? "connected" : "disconnected",
  });
});

export default mainRouter;
