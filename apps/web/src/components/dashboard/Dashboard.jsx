import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { SearchIcon, RepoIcon, PlusIcon } from "@primer/octicons-react";
import { useAuth } from "../../auth";
import { useQuery } from "../../hooks/useQuery";
import { useSocketEvent } from "../../hooks/useSocket";
import { useToasts } from "../ui/toastContext";
import Navbar from "../Navbar";
import Button from "../ui/Button";
import RepoCard from "../repo/RepoCard";
import { Loading, ErrorState, EmptyState } from "../ui/Status";
import "./dashboard.css";

const Dashboard = () => {
  const { currentUser } = useAuth();
  const { notify } = useToasts();
  const [searchQuery, setSearchQuery] = useState("");

  const mine = useQuery(`/repo/user/${currentUser}`, {
    enabled: Boolean(currentUser),
    select: (data) => data.repositories ?? [],
  });

  const suggested = useQuery("/repo/all", {
    select: (data) => (Array.isArray(data) ? data : []),
  });

  // Real-time: the API emits this to a repository owner when somebody else
  // opens an issue on one of their repositories.
  const onIssueCreated = useCallback(
    (payload) => {
      notify({
        title: "New issue opened",
        body: `${payload.title} — in ${payload.repositoryName}`,
      });
    },
    [notify]
  );

  useSocketEvent("issue:created", onIssueCreated, {
    enabled: Boolean(currentUser),
  });

  // Stabilised so the filter below is not recomputed on every render just
  // because the fallback literal is a fresh array each time.
  const repositories = useMemo(() => mine.data ?? [], [mine.data]);

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return repositories;

    return repositories.filter((repo) =>
      repo.name.toLowerCase().includes(query)
    );
  }, [searchQuery, repositories]);

  const suggestions = (suggested.data ?? [])
    .filter((repo) => repo.owner?._id !== currentUser)
    .slice(0, 6);

  return (
    <>
      <Navbar />

      <main className="page">
        <div className="dashboard">
          <aside className="dashboard-sidebar" aria-label="Suggestions">
            <section className="sidebar-panel">
              <h2 className="sidebar-panel-header">Explore repositories</h2>

              {suggested.isLoading && (
                <div className="sidebar-item muted">Loading…</div>
              )}

              {suggested.error && (
                <div className="sidebar-item">
                  <ErrorState
                    message={suggested.error}
                    onRetry={suggested.refetch}
                  />
                </div>
              )}

              {!suggested.isLoading &&
                !suggested.error &&
                (suggestions.length === 0 ? (
                  <p className="sidebar-item muted">Nothing to explore yet.</p>
                ) : (
                  suggestions.map((repo) => (
                    <Link
                      className="sidebar-item"
                      to={`/repo/${repo._id}`}
                      key={repo._id}
                    >
                      <span className="sidebar-item-name">
                        {repo.owner?.username
                          ? `${repo.owner.username}/${repo.name}`
                          : repo.name}
                      </span>
                      {repo.description && (
                        <span className="sidebar-item-description">
                          {repo.description}
                        </span>
                      )}
                    </Link>
                  ))
                ))}
            </section>
          </aside>

          <section aria-labelledby="your-repos">
            <div className="dashboard-toolbar">
              <h1 id="your-repos">Your repositories</h1>

              <div className="search-box">
                <SearchIcon size={16} />
                <input
                  type="search"
                  value={searchQuery}
                  placeholder="Find a repository…"
                  aria-label="Find a repository"
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <Link to="/new">
                <Button variant="primary" size="sm">
                  <PlusIcon size={14} />
                  New
                </Button>
              </Link>
            </div>

            {mine.isLoading && <Loading label="Loading your repositories…" />}

            {mine.error && (
              <ErrorState message={mine.error} onRetry={mine.refetch} />
            )}

            {!mine.isLoading && !mine.error && (
              <>
                {repositories.length === 0 && (
                  <EmptyState
                    icon={<RepoIcon size={24} />}
                    title="No repositories yet"
                    description="Create your first repository to get started."
                    action={
                      <Link to="/new">
                        <Button variant="primary">New repository</Button>
                      </Link>
                    }
                  />
                )}

                {repositories.length > 0 && searchResults.length === 0 && (
                  <EmptyState
                    icon={<SearchIcon size={24} />}
                    title="No matches"
                    description={`Nothing matched “${searchQuery}”.`}
                  />
                )}

                {searchResults.length > 0 && (
                  <div className="repo-grid">
                    {searchResults.map((repo) => (
                      <RepoCard repo={repo} key={repo._id} />
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </main>
    </>
  );
};

export default Dashboard;
