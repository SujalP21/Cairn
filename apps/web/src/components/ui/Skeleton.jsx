import "./ui.css";

/**
 * Content-shaped loading placeholders.
 *
 * A spinner says "wait"; a skeleton says "here is what is coming" and holds the
 * layout so nothing jumps when the data lands. These deliberately mirror the
 * real components' dimensions.
 */
export const Skeleton = ({ width, height = 14, radius, className = "" }) => (
  <span
    className={`skeleton ${className}`}
    style={{
      width: width ?? "100%",
      height,
      borderRadius: radius ?? "var(--radius-sm)",
    }}
  />
);

export const RepoCardSkeleton = () => (
  <div className="repo-card" aria-hidden="true">
    <div className="row">
      <Skeleton width={18} height={18} radius="var(--radius-sm)" />
      <Skeleton width="45%" height={17} />
    </div>
    <Skeleton width="90%" height={12} />
    <Skeleton width="60%" height={12} />
    <div className="row" style={{ marginTop: "auto", gap: "var(--space-4)" }}>
      <Skeleton width={70} height={11} />
      <Skeleton width={90} height={11} />
    </div>
  </div>
);

export const RepoGridSkeleton = ({ count = 4 }) => (
  <div className="repo-grid" role="status" aria-label="Loading repositories">
    {Array.from({ length: count }, (_, i) => (
      <RepoCardSkeleton key={i} />
    ))}
  </div>
);

export const IssueListSkeleton = ({ count = 3 }) => (
  <ul
    className="issue-list"
    style={{ listStyle: "none", padding: 0, margin: 0 }}
    role="status"
    aria-label="Loading issues"
  >
    {Array.from({ length: count }, (_, i) => (
      <li className="issue-row" key={i} aria-hidden="true">
        <Skeleton width={16} height={16} radius="50%" />
        <div className="stack" style={{ gap: 6, flex: 1 }}>
          <Skeleton width="35%" height={15} />
          <Skeleton width="70%" height={11} />
        </div>
      </li>
    ))}
  </ul>
);

export const SidebarSkeleton = ({ count = 4 }) => (
  <div role="status" aria-label="Loading">
    {Array.from({ length: count }, (_, i) => (
      <div className="sidebar-item" key={i} aria-hidden="true">
        <Skeleton width="70%" height={13} />
        <Skeleton width="90%" height={10} className="skeleton-spaced" />
      </div>
    ))}
  </div>
);

export const ProfileSkeleton = () => (
  <div className="profile-layout" role="status" aria-label="Loading profile">
    <div className="profile-sidebar" aria-hidden="true">
      <Skeleton width={200} height={200} radius="50%" />
      <Skeleton width="60%" height={26} />
      <Skeleton width="80%" height={13} />
      <Skeleton width="50%" height={13} />
    </div>
    <div aria-hidden="true">
      <Skeleton width="100%" height={44} />
      <Skeleton
        width="100%"
        height={180}
        radius="var(--radius-lg)"
        className="skeleton-spaced"
      />
    </div>
  </div>
);
