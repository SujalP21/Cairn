import type { CreateIssueInput, UpdateIssueInput } from "@cairn/shared";
import Issue from "../models/issueModel";
import Repository from "../models/repoModel";
import { asyncHandler } from "../lib/asyncHandler";
import { emitToUser } from "../services/socketService";

const AUTHOR_FIELDS = "username";

// req.repository is loaded and access-checked by requireRepoAccess("read").
// Any signed-in user who can see a repository may open an issue on it.
export const createIssue = asyncHandler<CreateIssueInput>(async (req, res) => {
  const { title, description } = req.body;
  const repository = req.repository!;

  const issue = await Issue.create({
    title,
    description,
    repository: repository._id,
    author: req.user!.id,
  });

  // Keep the repository's issue list in sync so `.populate("issues")` resolves.
  repository.issues.push(issue._id);
  await repository.save();

  // Notify the repository owner, unless they opened the issue themselves.
  if (String(repository.owner) !== req.user!.id) {
    emitToUser(repository.owner, "issue:created", {
      issueId: issue._id,
      repositoryId: repository._id,
      repositoryName: repository.name,
      title: issue.title,
    });
  }

  res.status(201).json(issue);
});

// req.issue is loaded and access-checked by requireIssueAccess("write").
export const updateIssueById = asyncHandler<UpdateIssueInput>(
  async (req, res) => {
    const { title, description, status } = req.body;
    const issue = req.issue!;

    // Only overwrite what the caller actually sent, so a partial update does not
    // blank out required fields.
    if (title !== undefined) issue.title = title;
    if (description !== undefined) issue.description = description;
    if (status !== undefined) issue.status = status;

    await issue.save();

    res.json({ message: "Issue updated", issue });
  }
);

export const deleteIssueById = asyncHandler(async (req, res) => {
  const issue = req.issue!;

  await issue.deleteOne();

  await Repository.findByIdAndUpdate(issue.repository, {
    $pull: { issues: issue._id },
  });

  res.json({ message: "Issue deleted" });
});

export const getAllIssues = asyncHandler(async (req, res) => {
  const issues = await Issue.find({ repository: req.repository!._id }).populate(
    "author",
    AUTHOR_FIELDS
  );

  res.status(200).json(issues);
});

export const getIssueById = asyncHandler(async (req, res) => {
  const issue = await req.issue!.populate("author", AUTHOR_FIELDS);

  res.json(issue);
});
