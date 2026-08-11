import { useNavigate } from "react-router-dom";
import { createRepoSchema } from "@cairn/shared";
import apiClient from "../../api/client";
import { useForm } from "../../hooks/useForm";
import Navbar from "../Navbar";
import Button from "../ui/Button";
import Field from "../ui/Field";
import "./repo.css";

const CreateRepository = () => {
  const navigate = useNavigate();

  const {
    values,
    errors,
    formError,
    isSubmitting,
    setValue,
    handleChange,
    handleSubmit,
  } = useForm({
    schema: createRepoSchema,
    initialValues: { name: "", description: "", visibility: true },
    onSubmit: async (data) => {
      const response = await apiClient.post("/repo/create", data);
      navigate(`/repo/${response.data.repositoryID}`, { replace: true });
    },
  });

  return (
    <>
      <Navbar />

      <main className="page page-narrow">
        <div className="create-header">
          <h1>Create a new repository</h1>
          <p className="muted">
            A repository contains your project&apos;s files and its issue
            history.
          </p>
        </div>

        <form className="create-form" onSubmit={handleSubmit} noValidate>
          {formError && (
            <div className="alert" role="alert">
              {formError}
            </div>
          )}

          <Field
            label="Repository name"
            name="name"
            value={values.name}
            onChange={handleChange}
            error={errors.name}
            hint="Letters, numbers, dots, underscores and hyphens."
            autoFocus
          />

          <Field
            label="Description"
            name="description"
            as="textarea"
            value={values.description}
            onChange={handleChange}
            error={errors.description}
            hint="Optional."
          />

          <fieldset
            className="visibility-options"
            style={{ border: 0, padding: 0, margin: 0 }}
          >
            <legend className="field-label" style={{ paddingBottom: 8 }}>
              Visibility
            </legend>

            <label
              className={`option ${values.visibility ? "option-selected" : ""}`}
            >
              <input
                type="radio"
                name="visibility"
                aria-label="Public"
                checked={values.visibility === true}
                onChange={() => setValue("visibility", true)}
              />
              <span>
                <span className="option-title">Public</span>
                <span className="option-description">
                  Anyone can see this repository.
                </span>
              </span>
            </label>

            <label
              className={`option ${!values.visibility ? "option-selected" : ""}`}
            >
              <input
                type="radio"
                name="visibility"
                aria-label="Private"
                checked={values.visibility === false}
                onChange={() => setValue("visibility", false)}
              />
              <span>
                <span className="option-title">Private</span>
                <span className="option-description">
                  Only you can see this repository.
                </span>
              </span>
            </label>
          </fieldset>

          <div className="form-footer">
            <Button type="button" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={isSubmitting}>
              {isSubmitting ? "Creating…" : "Create repository"}
            </Button>
          </div>
        </form>
      </main>
    </>
  );
};

export default CreateRepository;
