import { useEffect } from "react";
import { useNavigate, useLocation, useRoutes } from "react-router-dom";

// Pages List
import Dashboard from "./components/dashboard/Dashboard";
import Profile from "./components/user/Profile";
import Login from "./components/auth/Login";
import Signup from "./components/auth/Signup";

// Auth Context
import { useAuth } from "./auth";

const PUBLIC_PATHS = ["/auth", "/signup"];

const ProjectRoutes = () => {
  const { currentUser, isBootstrapping } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Wait for the refresh attempt to settle before deciding anything, or a
    // signed-in user reloading the page would be bounced to /auth.
    if (isBootstrapping) return;

    const isPublic = PUBLIC_PATHS.includes(location.pathname);

    if (!currentUser && !isPublic) {
      navigate("/auth", { replace: true });
    }

    if (currentUser && isPublic) {
      navigate("/", { replace: true });
    }
  }, [currentUser, isBootstrapping, location.pathname, navigate]);

  const element = useRoutes([
    {
      path: "/",
      element: <Dashboard />,
    },
    {
      path: "/auth",
      element: <Login />,
    },
    {
      path: "/signup",
      element: <Signup />,
    },
    {
      path: "/profile",
      element: <Profile />,
    },
  ]);

  if (isBootstrapping) {
    return <p className="route-loading">Loading…</p>;
  }

  return element;
};

export default ProjectRoutes;
