import express from "express";
import { createRepoSchema, updateRepoSchema, idParams } from "@cairn/shared";
import * as repoController from "../controllers/repoController";
import { validate } from "../middleware/validate";
import {
  authenticate,
  authenticateOptional,
} from "../middleware/authMiddleware";
import { requireRepoAccess } from "../middleware/authorizeMiddleware";

const repoRouter = express.Router();

// ---------------------------------------------------------------------------
// Route                     Auth        Authorization
// ---------------------------------------------------------------------------
// POST   /repo/create       required    owner taken from token, not body
// GET    /repo/all          optional    public repos + own private ones
// GET    /repo/:id          optional    read access (private ⇒ 404 for others)
// GET    /repo/name/:name   optional    visibility-filtered lookup
// GET    /repo/user/:userID optional    all if self, else public only
// PUT    /repo/update/:id   required    owner only
// PATCH  /repo/toggle/:id   required    owner only
// DELETE /repo/delete/:id   required    owner only
// ---------------------------------------------------------------------------

repoRouter.post(
  "/repo/create",
  authenticate,
  validate({ body: createRepoSchema }),
  repoController.createRepository
);

repoRouter.get(
  "/repo/all",
  authenticateOptional,
  repoController.getAllRepositories
);

repoRouter.get(
  "/repo/name/:name",
  authenticateOptional,
  repoController.fetchRepositoryByName
);

repoRouter.get(
  "/repo/user/:userID",
  authenticateOptional,
  repoController.fetchRepositoriesForCurrentUser
);

repoRouter.get(
  "/repo/:id",
  authenticateOptional,
  validate({ params: idParams }),
  requireRepoAccess("read", "id"),
  repoController.fetchRepositoryById
);

repoRouter.put(
  "/repo/update/:id",
  authenticate,
  validate({ params: idParams, body: updateRepoSchema }),
  requireRepoAccess("write", "id"),
  repoController.updateRepositoryById
);

repoRouter.patch(
  "/repo/toggle/:id",
  authenticate,
  validate({ params: idParams }),
  requireRepoAccess("write", "id"),
  repoController.toggleVisibilityById
);

repoRouter.delete(
  "/repo/delete/:id",
  authenticate,
  validate({ params: idParams }),
  requireRepoAccess("write", "id"),
  repoController.deleteRepositoryById
);

export default repoRouter;
