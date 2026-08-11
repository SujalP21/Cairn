import { z } from "zod";

export const repoName = z
  .string()
  .trim()
  .min(1, "is required")
  .max(100, "must be at most 100 characters")
  .regex(
    /^[a-zA-Z0-9._-]+$/,
    "may only contain letters, numbers, dots, underscores and hyphens"
  );

export const repoDescription = z
  .string()
  .trim()
  .max(350, "must be at most 350 characters");

// `owner` is deliberately absent: it is taken from the authenticated user, never
// from the request body, so a caller cannot create a repository for someone else.
export const createRepoSchema = z.object({
  name: repoName,
  description: repoDescription.optional(),
  visibility: z.boolean().optional().default(true),
  content: z.array(z.string()).optional(),
});

export const updateRepoSchema = z
  .object({
    content: z.string().optional(),
    description: repoDescription.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "provide at least one field to update",
  });

export type CreateRepoInput = z.infer<typeof createRepoSchema>;
export type UpdateRepoInput = z.infer<typeof updateRepoSchema>;
