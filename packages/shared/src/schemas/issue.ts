import { z } from "zod";

export const ISSUE_STATUSES = ["open", "closed"] as const;

export const issueTitle = z
  .string()
  .trim()
  .min(1, "is required")
  .max(200, "must be at most 200 characters");

export const issueDescription = z
  .string()
  .trim()
  .min(1, "is required")
  .max(10000, "must be at most 10000 characters");

export const createIssueSchema = z.object({
  title: issueTitle,
  description: issueDescription,
});

export const updateIssueSchema = z
  .object({
    title: issueTitle.optional(),
    description: issueDescription.optional(),
    status: z.enum(ISSUE_STATUSES).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "provide at least one field to update",
  });

export type IssueStatus = (typeof ISSUE_STATUSES)[number];
export type CreateIssueInput = z.infer<typeof createIssueSchema>;
export type UpdateIssueInput = z.infer<typeof updateIssueSchema>;
