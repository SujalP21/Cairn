import type { RepositoryDocument } from "../models/repoModel";
import type { IssueDocument } from "../models/issueModel";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Set by authenticate/authenticateOptional from a verified access token. */
      user?: { id: string };
      /** Loaded and access-checked by requireRepoAccess. */
      repository?: RepositoryDocument;
      /** Loaded and access-checked by requireIssueAccess. */
      issue?: IssueDocument;
    }
  }
}

export {};
