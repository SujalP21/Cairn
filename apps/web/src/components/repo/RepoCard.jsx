import { Link } from "react-router-dom";
import { RepoIcon, LockIcon, IssueOpenedIcon } from "@primer/octicons-react";
import "./repo.css";

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

const RepoCard = ({ repo }) => {
  const isPrivate = repo.visibility === false;
  const updated = formatDate(repo.updatedAt);

  return (
    <article className="repo-card">
      <h3 className="repo-card-title">
        <span className="muted" aria-hidden="true">
          {isPrivate ? <LockIcon size={16} /> : <RepoIcon size={16} />}
        </span>
        <Link to={`/repo/${repo._id}`}>{repo.name}</Link>
        <span className="badge">{isPrivate ? "Private" : "Public"}</span>
      </h3>

      {repo.description && (
        <p className="repo-card-description">{repo.description}</p>
      )}

      <div className="repo-card-meta">
        {Array.isArray(repo.issues) && (
          <span className="row" style={{ gap: "var(--space-1)" }}>
            <IssueOpenedIcon size={14} />
            {repo.issues.length} {repo.issues.length === 1 ? "issue" : "issues"}
          </span>
        )}
        {updated && <span>Updated {updated}</span>}
      </div>
    </article>
  );
};

export default RepoCard;
