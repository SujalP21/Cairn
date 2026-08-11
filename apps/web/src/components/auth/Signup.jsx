import { Link, useNavigate } from "react-router-dom";
import { signupSchema } from "@cairn/shared";
import apiClient, { setAccessToken } from "../../api/client";
import { useAuth } from "../../auth";
import { useForm } from "../../hooks/useForm";
import Button from "../ui/Button";
import Field from "../ui/Field";
import AuthLayout from "./AuthLayout";

const Signup = () => {
  const { setCurrentUser } = useAuth();
  const navigate = useNavigate();

  const {
    values,
    errors,
    formError,
    isSubmitting,
    handleChange,
    handleSubmit,
  } = useForm({
    schema: signupSchema,
    initialValues: { username: "", email: "", password: "" },
    onSubmit: async (data) => {
      const res = await apiClient.post("/signup", data);

      setAccessToken(res.data.accessToken);
      setCurrentUser(res.data.userId);

      navigate("/", { replace: true });
    },
  });

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Free, and takes about ten seconds."
      footer={
        <p className="auth-alt">
          Already have an account? <Link to="/auth">Login</Link>
        </p>
      }
    >
      <form className="auth-card" onSubmit={handleSubmit} noValidate>
        {formError && (
          <div className="alert" role="alert">
            {formError}
          </div>
        )}

        <Field
          label="Username"
          name="username"
          autoComplete="username"
          hint="Letters, numbers and single hyphens."
          value={values.username}
          onChange={handleChange}
          error={errors.username}
        />

        <Field
          label="Email address"
          name="email"
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={handleChange}
          error={errors.email}
        />

        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters."
          value={values.password}
          onChange={handleChange}
          error={errors.password}
        />

        <Button type="submit" variant="primary" block loading={isSubmitting}>
          {isSubmitting ? "Creating account…" : "Signup"}
        </Button>
      </form>
    </AuthLayout>
  );
};

export default Signup;
