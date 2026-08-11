import { useCallback, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  RepoIcon,
  LockIcon,
  FileIcon,
  IssueOpenedIcon,
  IssueClosedIcon,
  TrashIcon,
} from "@primer/octicons-react";
import { createIssueSchema } from "@cairn/shared";
import apiClient from "../../api/client";
import { getErrorMessage } from "../../api/errors";
import { useAuth } from "../../auth";
import { useQuery } from "../../hooks/useQuery";
import { useForm } from "../../hooks/useForm";
import Navbar from "../Navbar";
import Button from "../ui/Button";
import Field from "../ui/Field";
import { Loading, ErrorState, EmptyState } from "../ui/Status";
import "./repo.css";

const IssueRow = ({ issue, canManage, onToggle, onDelete, busyId }) => {
  const isOpen = issue.status !== "closed";

  return (
    <li className="issue-row">
      <span className={isOpen ? "issue-icon-open" : "issue-icon-closed"}>
        {isOpen ? <IssueOpenedIcon size={16} /> : <IssueClosedIcon size={16} />}
      </span>

      <div className="stack" style={{ gap: 2 }}>
        <span className="issue-title">{issue.title}</span>
        <span className="issue-meta">
          {issue.description}
          {issue.author?.username
            ? ` · opened by ${issue.author.username}`
            : ""}
        </span>
      </div>

      {canManage && (
        <div className="issue-actions">
          <Button
            size="sm"
            onClick={() => onToggle(issue)}
            loading={busyId === issue._id}
          >
            {isOpen ? "Close" : "Reopen"}
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => onDelete(issue)}
            aria-label={`Delete issue ${issue.title}`}
          >
            <TrashIcon size={14} />
          </Button>
        </div>
      )}
    </li>
  );
};

const RepositoryDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState(null);

  const repoQuery = useQuery(`/repo/${id}`);
  const issuesQuery = useQuery(`/issue/all/${id}`);

  const repo = repoQuery.data;
  const issues = issuesQuery.data ?? [];
  const isOwner = Boolean(
    repo && currentUser && repo.owner?._id === currentUser
  );

  const refetchIssues = issuesQuery.refetch;

  const issueForm = useForm({
    schema: createIssueSchema,
    initialValues: { title: "", description: "" },
    onSubmit: async (data) => {
      await apiClient.post(`/issue/create/${id}`, data);
      issueForm.setValue("title", "");
      issueForm.setValue("description", "");
      await refetchIssues();
    },
  });

  const toggleIssue = useCallback(
    async (issue) => {
      setActionError(null);
      setBusyId(issue._id);

      try {
        await apiClient.put(`/issue/update/${issue._id}`, {
          status: issue.status === "closed" ? "open" : "closed",
        });
        await refetchIssues();
      } catch (err) {
        setActionError(getErrorMessage(err));
      } finally {
        setBusyId(null);
      }
    },
    [refetchIssues]
  );

  const deleteIssue = useCallback(
    async (issue) => {
      setActionError(null);

      try {
        await apiClient.delete(`/issue/delete/${issue._id}`);
        await refetchIssues();
      } catch (err) {
        setActionError(getErrorMessage(err));
      }
    },
    [refetchIssues]
  );

  const deleteRepository = useCallback(async () => {
    setActionError(null);

    try {
      await apiClient.delete(`/repo/delete/${id}`);
      navigate("/", { replace: true });
    } catch (err) {
      setActionError(getErrorMessage(err));
    }
  }, [id, navigate]);

  if (repoQuery.isLoading) {
    return (
      <>
        <Navbar />
        <main className="page">
          <Loading label="Loading repository…" />
        </main>
      </>
    );
  }

  if (repoQuery.error) {
    return (
      <>
        <Navbar />
        <main className="page">
          <ErrorState message={repoQuery.error} onRetry={repoQuery.refetch} />
        </main>
      </>
    );
  }

  const files = Array.isArray(repo?.content) ? repo.content : [];

  return (
    <>
      <Navbar />

      <main className="page stack" style={{ gap: "var(--space-5)" }}>
        <header className="repo-header">
          <h1>
            <span className="muted" aria-hidden="true">
              {repo.visibility === false ? (
                <LockIcon size={20} />
              ) : (
                <RepoIcon size={20} />
              )}
            </span>
            {repo.name}
            <span className="badge">
              {repo.visibility === false ? "Private" : "Public"}
            </span>
          </h1>

          {isOwner && (
            <div className="repo-header-actions">
              <Button variant="danger" size="sm" onClick={deleteRepository}>
                Delete repository
              </Button>
            </div>
          )}
        </header>

        {repo.description && <p className="muted">{repo.description}</p>}
        {repo.owner?.username && (
          <p className="muted">Owned by {repo.owner.username}</p>
        )}

        {actionError && <ErrorState message={actionError} />}

        <div className="repo-layout">
          <section className="stack" aria-labelledby="issues-heading">
            <h2 id="issues-heading" style={{ fontSize: "var(--text-md)" }}>
              Issues
            </h2>

            {issuesQuery.isLoading && <Loading label="Loading issues…" />}

            {issuesQuery.error && (
              <ErrorState
                message={issuesQuery.error}
                onRetry={issuesQuery.refetch}
              />
            )}

            {!issuesQuery.isLoading && !issuesQuery.error && (
              <>
                {issues.length === 0 ? (
                  <EmptyState
                    icon={<IssueOpenedIcon size={24} />}
                    title="No issues yet"
                    description="Open the first one below."
                  />
                ) : (
                  <ul
                    className="issue-list"
                    style={{ listStyle: "none", padding: 0, margin: 0 }}
                  >
                    {issues.map((issue) => (
                      <IssueRow
                        key={issue._id}
                        issue={issue}
                        canManage={isOwner}
                        onToggle={toggleIssue}
                        onDelete={deleteIssue}
                        busyId={busyId}
                      />
                    ))}
                  </ul>
                )}

                <form
                  className="card stack"
                  onSubmit={issueForm.handleSubmit}
                  noValidate
                >
                  <h3>Open a new issue</h3>

                  {issueForm.formError && (
                    <div className="alert" role="alert">
                      {issueForm.formError}
                    </div>
                  )}

                  <Field
                    label="Title"
                    name="title"
                    value={issueForm.values.title}
                    onChange={issueForm.handleChange}
                    error={issueForm.errors.title}
                  />

                  <Field
                    label="Description"
                    name="description"
                    as="textarea"
                    value={issueForm.values.description}
                    onChange={issueForm.handleChange}
                    error={issueForm.errors.description}
                  />

                  <div>
                    <Button
                      type="submit"
                      variant="primary"
                      loading={issueForm.isSubmitting}
                    >
                      {issueForm.isSubmitting ? "Submitting…" : "Submit issue"}
                    </Button>
                  </div>
                </form>
              </>
            )}
          </section>

          <aside className="repo-files" aria-label="Files">
            <div className="repo-files-header">
              Files {files.length > 0 && `(${files.length})`}
            </div>

            {files.length === 0 ? (
              <div className="repo-file muted">No files committed yet</div>
            ) : (
              files.map((file, index) => (
                <div className="repo-file" key={`${file}-${index}`}>
                  <span className="repo-file-icon">
                    <FileIcon size={16} />
                  </span>
                  {file}
                </div>
              ))
            )}
          </aside>
        </div>
      </main>
    </>
  );
};

export default RepositoryDetail;
