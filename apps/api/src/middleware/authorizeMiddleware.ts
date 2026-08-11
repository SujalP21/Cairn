import type { Request, RequestHandler } from "express";
import Repository from "../models/repoModel";
import Issue from "../models/issueModel";
import { asyncHandler } from "../lib/asyncHandler";
import { ForbiddenError, NotFoundError } from "../lib/errors";

type AccessMode = "read" | "write";

function isOwner(ownerId: unknown, req: Request): boolean {
  return Boolean(req.user) && String(ownerId) === req.user?.id;
}

// Only the account holder may modify their own profile record.
export function requireSelf(paramName = "id"): RequestHandler {
  return (req, _res, next) => {
    if (!req.user || req.params[paramName] !== req.user.id) {
      return next(new ForbiddenError("You may only modify your own profile"));
    }

    return next();
  };
}

/**
 * Loads the repository named by `paramName` and attaches it as req.repository.
 *
 * "read" means public repositories are visible to everyone and private ones
 * only to their owner; "write" means owner only.
 *
 * A private repository returns 404 rather than 403 to a non-owner, so the API
 * does not confirm that a repository exists to someone not allowed to see it.
 */
export function requireRepoAccess(
  mode: AccessMode,
  paramName = "id"
): RequestHandler {
  return asyncHandler(async (req, _res, next) => {
    const repository = await Repository.findById(req.params[paramName]);

    if (!repository) {
      throw new NotFoundError("Repository not found!");
    }

    const owner = isOwner(repository.owner, req);

    if (mode === "write" && !owner) {
      throw new ForbiddenError("Only the repository owner may do that");
    }

    if (mode === "read" && !owner && repository.visibility === false) {
      throw new NotFoundError("Repository not found!");
    }

    req.repository = repository;
    next();
  });
}

// Same rules, but reached via an issue id: resolve the issue's repository first.
export function requireIssueAccess(
  mode: AccessMode,
  paramName = "id"
): RequestHandler {
  return asyncHandler(async (req, _res, next) => {
    const issue = await Issue.findById(req.params[paramName]);

    if (!issue) {
      throw new NotFoundError("Issue not found!");
    }

    const repository = await Repository.findById(issue.repository);

    if (!repository) {
      throw new NotFoundError("Repository not found!");
    }

    const owner = isOwner(repository.owner, req);

    if (mode === "write" && !owner) {
      throw new ForbiddenError("Only the repository owner may do that");
    }

    if (mode === "read" && !owner && repository.visibility === false) {
      throw new NotFoundError("Issue not found!");
    }

    req.issue = issue;
    req.repository = repository;
    next();
  });
}
