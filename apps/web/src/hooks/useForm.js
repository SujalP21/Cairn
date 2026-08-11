import { useCallback, useState } from "react";
import { getErrorMessage, getFieldErrors } from "../api/errors";

/**
 * Form state with validation driven by a shared Zod schema.
 *
 * The same schema object the API validates against is used here, so the client
 * cannot drift from the server about what is acceptable. Server-side field
 * errors are merged into the same `errors` map, meaning a rule that only the
 * API can check (a duplicate username, say) surfaces on the field rather than
 * as a bare alert.
 */
export function useForm({ schema, initialValues, onSubmit }) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const setValue = useCallback((name, value) => {
    setValues((current) => ({ ...current, [name]: value }));
    // Clear the field's error as soon as the user edits it; re-validating on
    // every keystroke is noisy while someone is still typing.
    setErrors((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
  }, []);

  const handleChange = useCallback(
    (event) => setValue(event.target.name, event.target.value),
    [setValue]
  );

  const validate = useCallback(() => {
    if (!schema) return { ok: true, data: values };

    const result = schema.safeParse(values);

    if (result.success) {
      setErrors({});
      return { ok: true, data: result.data };
    }

    const fieldErrors = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0] ?? "form";
      // Keep the first message per field: showing three at once is noise.
      fieldErrors[key] ??= issue.message;
    }

    setErrors(fieldErrors);
    return { ok: false };
  }, [schema, values]);

  const handleSubmit = useCallback(
    async (event) => {
      event?.preventDefault();
      setFormError(null);

      const result = validate();
      if (!result.ok) return;

      setIsSubmitting(true);

      try {
        await onSubmit(result.data);
      } catch (err) {
        const serverFieldErrors = getFieldErrors(err);

        if (Object.keys(serverFieldErrors).length > 0) {
          setErrors(serverFieldErrors);
        } else {
          setFormError(getErrorMessage(err));
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [validate, onSubmit]
  );

  return {
    values,
    errors,
    formError,
    isSubmitting,
    setValue,
    handleChange,
    handleSubmit,
    setFormError,
  };
}
