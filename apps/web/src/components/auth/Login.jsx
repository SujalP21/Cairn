import { Link, useNavigate } from "react-router-dom";
import { loginSchema } from "@cairn/shared";
import apiClient, { setAccessToken } from "../../api/client";
import { useAuth } from "../../auth";
import { useForm } from "../../hooks/useForm";
import Button from "../ui/Button";
import Field from "../ui/Field";
import AuthLayout from "./AuthLayout";

const Login = () => {
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
    schema: loginSchema,
    initialValues: { email: "", password: "" },
    onSubmit: async (data) => {
      const res = await apiClient.post("/login", data);

      // Access token stays in memory; the refresh token arrives as an
      // httpOnly cookie the browser stores and JavaScript cannot read.
      setAccessToken(res.data.accessToken);
      setCurrentUser(res.data.userId);

      // navigate() rather than window.location, which would reload the page
      // and discard the in-memory access token.
      navigate("/", { replace: true });
    },
  });

  return (
    <AuthLayout
      title="Sign in to Cairn"
      subtitle="Welcome back."
      footer={
        <p className="auth-alt">
          New to Cairn? <Link to="/signup">Create an account</Link>
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
          autoComplete="current-password"
          value={values.password}
          onChange={handleChange}
          error={errors.password}
        />

        <Button type="submit" variant="primary" block loading={isSubmitting}>
          {isSubmitting ? "Signing in…" : "Login"}
        </Button>
      </form>
    </AuthLayout>
  );
};

export default Login;
