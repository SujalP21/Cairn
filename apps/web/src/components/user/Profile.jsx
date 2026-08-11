import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookIcon, RepoIcon, SignOutIcon } from "@primer/octicons-react";
import { useAuth } from "../../auth";
import { useQuery } from "../../hooks/useQuery";
import Navbar from "../Navbar";
import Button from "../ui/Button";
import RepoCard from "../repo/RepoCard";
import HeatMapProfile from "./HeatMap";
import Avatar from "../ui/Avatar";
import { ErrorState, EmptyState } from "../ui/Status";
import { ProfileSkeleton, RepoGridSkeleton } from "../ui/Skeleton";
import "./profile.css";
import "../repo/repo.css";

const Profile = () => {
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  const [tab, setTab] = useState("overview");

  const profile = useQuery(`/userProfile/${currentUser}`, {
    enabled: Boolean(currentUser),
  });

  const repos = useQuery(`/repo/user/${currentUser}`, {
    enabled: Boolean(currentUser),
    select: (data) => data.repositories ?? [],
  });

  const username = profile.data?.username ?? "";
  const repositories = repos.data ?? [];

  const joined = profile.data?.createdAt
    ? new Date(profile.data.createdAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
      })
    : null;

  return (
    <>
      <Navbar />

      <main className="page">
        {profile.isLoading && <ProfileSkeleton />}

        {profile.error && (
          <ErrorState message={profile.error} onRetry={profile.refetch} />
        )}

        {!profile.isLoading && !profile.error && (
          <div className="profile-layout">
            <aside className="profile-sidebar">
              <Avatar
                userId={currentUser}
                name={username}
                size={200}
                className="profile-avatar"
              />

              <h1 className="profile-name">{username}</h1>

              {profile.data?.email && (
                <p className="profile-meta">{profile.data.email}</p>
              )}

              {joined && <p className="profile-meta">Joined {joined}</p>}

              <p className="profile-meta">
                {repositories.length}{" "}
                {repositories.length === 1 ? "repository" : "repositories"}
              </p>

              <Button
                onClick={async () => {
                  await logout();
                  navigate("/auth", { replace: true });
                }}
              >
                <SignOutIcon size={16} />
                Sign out
              </Button>
            </aside>

            <section>
              <div className="profile-tabs" role="tablist">
                <button
                  className={`profile-tab ${tab === "overview" ? "profile-tab-active" : ""}`}
                  onClick={() => setTab("overview")}
                  role="tab"
                  aria-selected={tab === "overview"}
                  type="button"
                >
                  <BookIcon size={16} />
                  Overview
                </button>

                <button
                  className={`profile-tab ${tab === "repositories" ? "profile-tab-active" : ""}`}
                  onClick={() => setTab("repositories")}
                  role="tab"
                  aria-selected={tab === "repositories"}
                  type="button"
                >
                  <RepoIcon size={16} />
                  Repositories
                </button>
              </div>

              {tab === "overview" && (
                <div className="heatmap-panel">
                  <HeatMapProfile />
                </div>
              )}

              {tab === "repositories" && (
                <>
                  {repos.isLoading && <RepoGridSkeleton count={2} />}

                  {repos.error && (
                    <ErrorState message={repos.error} onRetry={repos.refetch} />
                  )}

                  {!repos.isLoading &&
                    !repos.error &&
                    (repositories.length === 0 ? (
                      <EmptyState
                        icon={<RepoIcon size={24} />}
                        title="No repositories yet"
                      />
                    ) : (
                      <div className="repo-grid">
                        {repositories.map((repo) => (
                          <RepoCard repo={repo} key={repo._id} />
                        ))}
                      </div>
                    ))}
                </>
              )}
            </section>
          </div>
        )}
      </main>
    </>
  );
};

export default Profile;
