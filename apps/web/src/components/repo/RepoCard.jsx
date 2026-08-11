import { Link } from "react-router-dom";
import {
  RepoIcon,
  LockIcon,
  IssueOpenedIcon,
  CheckIcon,
  FileIcon,
} from "@primer/octicons-react";
import { timeAgo, accentFor } from "../../lib/format";
import "./repo.css";

const RepoCard = ({ repo }) => {
  const isPrivate = repo.visibility === false;
  const accent = accentFor(repo.name);

  const issues = Array.isArray(repo.issues) ? repo.issues : [];

  // Some endpoints populate `issues` with documents, others return bare ids.
  // The total is always available; the open/closed split only when populated.
  const populated = issues.filter(
    (issue) => issue && typeof issue === "object"
  );
  const hasStatuses = populated.length === issues.length && issues.length > 0;
  const open = populated.filter((issue) => issue.status !== "closed").length;
  const closed = populated.length - open;

  const files = Array.isArray(repo.content) ? repo.content.length : 0;
  const updated = timeAgo(repo.updatedAt ?? repo.createdAt);

  return (
    <article className="repo-card" style={{ "--repo-accent": accent }}>
      <span className="repo-card-accent" aria-hidden="true" />

      <h3 className="repo-card-title">
        <span className="repo-card-icon" aria-hidden="true">
          {isPrivate ? <LockIcon size={16} /> : <RepoIcon size={16} />}
        </span>
        <Link to={`/repo/${repo._id}`}>{repo.name}</Link>
      </h3>

      <p className="repo-card-description">
        {repo.description || (
          <span className="repo-card-nodesc">No description</span>
        )}
      </p>

      <div className="repo-card-meta">
        <span className={`badge ${isPrivate ? "" : "badge-accent"}`}>
          {isPrivate ? "Private" : "Public"}
        </span>

        {hasStatuses ? (
          <>
            <span className="repo-card-stat">
              <IssueOpenedIcon size={13} />
              {open} open
            </span>
            {closed > 0 && (
              <span className="repo-card-stat">
                <CheckIcon size={13} />
                {closed} closed
              </span>
            )}
          </>
        ) : (
          issues.length > 0 && (
            <span className="repo-card-stat">
              <IssueOpenedIcon size={13} />
              {issues.length} {issues.length === 1 ? "issue" : "issues"}
            </span>
          )
        )}

        {files > 0 && (
          <span className="repo-card-stat">
            <FileIcon size={13} />
            {files} {files === 1 ? "file" : "files"}
          </span>
        )}
      </div>

      {updated && <div className="repo-card-updated">Updated {updated}</div>}
    </article>
  );
};

export default RepoCard;
