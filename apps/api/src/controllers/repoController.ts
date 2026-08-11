import type { Request } from "express";
import type { FilterQuery } from "mongoose";
import type { CreateRepoInput, UpdateRepoInput } from "@cairn/shared";
import Repository, { type RepositoryAttrs } from "../models/repoModel";
import { asyncHandler } from "../lib/asyncHandler";
import { NotFoundError } from "../lib/errors";

// Never populate the owner wholesale — that would embed the full user document
// in every repository response.
const OWNER_FIELDS = "username";

// Anonymous callers see public repositories; signed-in callers additionally see
// their own private ones.
function visibilityFilter(req: Request): FilterQuery<RepositoryAttrs> {
  if (!req.user) {
    return { visibility: { $ne: false } };
  }

  return {
    $or: [{ visibility: { $ne: false } }, { owner: req.user.id }],
  };
}

export const createRepository = asyncHandler<CreateRepoInput>(
  async (req, res) => {
    const { name, description, visibility, content } = req.body;

    // Ownership comes from the verified token, never from the request body.
    const result = await Repository.create({
      name,
      description,
      visibility,
      content,
      owner: req.user!.id,
      issues: [],
    });

    res.status(201).json({
      message: "Repository created!",
      repositoryID: result._id,
    });
  }
);

export const getAllRepositories = asyncHandler(async (req, res) => {
  const repositories = await Repository.find(visibilityFilter(req))
    .populate("owner", OWNER_FIELDS)
    .populate("issues");

  res.json(repositories);
});

// req.repository was already loaded and access-checked by requireRepoAccess.
export const fetchRepositoryById = asyncHandler(async (req, res) => {
  const repository = await req.repository!.populate([
    { path: "owner", select: OWNER_FIELDS },
    { path: "issues" },
  ]);

  res.json(repository);
});

export const fetchRepositoryByName = asyncHandler(async (req, res) => {
  const repository = await Repository.findOne({
    name: req.params.name,
    ...visibilityFilter(req),
  })
    .populate("owner", OWNER_FIELDS)
    .populate("issues");

  if (!repository) {
    throw new NotFoundError("Repository not found!");
  }

  res.json(repository);
});

export const fetchRepositoriesForCurrentUser = asyncHandler(
  async (req, res) => {
    const { userID } = req.params;
    const isSelf = req.user?.id === userID;

    const repositories = await Repository.find({
      owner: userID,
      ...(isSelf ? {} : { visibility: { $ne: false } }),
    }).populate("owner", OWNER_FIELDS);

    // An empty list is a valid answer, not a 404.
    res.json({ message: "Repositories found!", repositories });
  }
);

export const updateRepositoryById = asyncHandler<UpdateRepoInput>(
  async (req, res) => {
    const { content, description } = req.body;
    const repository = req.repository!;

    if (content !== undefined) repository.content.push(content);
    if (description !== undefined) repository.description = description;

    const updatedRepository = await repository.save();

    res.json({
      message: "Repository updated successfully!",
      repository: updatedRepository,
    });
  }
);

export const toggleVisibilityById = asyncHandler(async (req, res) => {
  const repository = req.repository!;

  repository.visibility = !repository.visibility;

  const updatedRepository = await repository.save();

  res.json({
    message: "Repository visibility toggled successfully!",
    repository: updatedRepository,
  });
});

export const deleteRepositoryById = asyncHandler(async (req, res) => {
  await req.repository!.deleteOne();

  res.json({ message: "Repository deleted successfully!" });
});
