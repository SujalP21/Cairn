import { z } from "zod";

// Mongo ObjectIds as they appear in URLs and request bodies.
export const objectId = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "must be a 24-character hex ObjectId");

export const idParams = z.object({ id: objectId });
export const repoIdParams = z.object({ repoId: objectId });

export type IdParams = z.infer<typeof idParams>;
export type RepoIdParams = z.infer<typeof repoIdParams>;
