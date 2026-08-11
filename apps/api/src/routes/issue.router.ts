import express from "express";
import {
  createIssueSchema,
  updateIssueSchema,
  idParams,
  repoIdParams,
} from "@cairn/shared";
import * as issueController from "../controllers/issueController";
import { validate } from "../middleware/validate";
import {
  authenticate,
  authenticateOptional,
} from "../middleware/authMiddleware";
import {
  requireRepoAccess,
  requireIssueAccess,
} from "../middleware/authorizeMiddleware";

const issueRouter = express.Router();

// ---------------------------------------------------------------------------
// Route                        Auth        Authorization
// ---------------------------------------------------------------------------
// POST   /issue/create/:repoId required    repo must be readable by caller
// GET    /issue/all/:repoId    optional    repo must be readable by caller
// GET    /issue/:id            optional    parent repo must be readable
// PUT    /issue/update/:id     required    parent repo owner only
// DELETE /issue/delete/:id     required    parent repo owner only
// ---------------------------------------------------------------------------

issueRouter.post(
  "/issue/create/:repoId",
  authenticate,
  validate({ params: repoIdParams, body: createIssueSchema }),
  requireRepoAccess("read", "repoId"),
  issueController.createIssue
);

issueRouter.get(
  "/issue/all/:repoId",
  authenticateOptional,
  validate({ params: repoIdParams }),
  requireRepoAccess("read", "repoId"),
  issueController.getAllIssues
);

issueRouter.put(
  "/issue/update/:id",
  authenticate,
  validate({ params: idParams, body: updateIssueSchema }),
  requireIssueAccess("write", "id"),
  issueController.updateIssueById
);

issueRouter.delete(
  "/issue/delete/:id",
  authenticate,
  validate({ params: idParams }),
  requireIssueAccess("write", "id"),
  issueController.deleteIssueById
);

issueRouter.get(
  "/issue/:id",
  authenticateOptional,
  validate({ params: idParams }),
  requireIssueAccess("read", "id"),
  issueController.getIssueById
);

export default issueRouter;
