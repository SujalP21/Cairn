import { useEffect } from "react";
import { useNavigate, useLocation, useRoutes } from "react-router-dom";

// Pages
import Landing from "./components/Landing";
import Dashboard from "./components/dashboard/Dashboard";
import Profile from "./components/user/Profile";
import Login from "./components/auth/Login";
import Signup from "./components/auth/Signup";
import CreateRepository from "./components/repo/CreateRepository";
import RepositoryDetail from "./components/repo/RepositoryDetail";
import NotFound from "./components/NotFound";

import { useAuth } from "./auth";
import { Loading } from "./components/ui/Status";
import { disconnectSocket } from "./hooks/useSocket";

// "/" is public: signed-out visitors get the landing page rather than being
// bounced straight to a login box with no explanation of what this is.
const PUBLIC_PATHS = ["/", "/auth", "/signup"];
const SIGNED_OUT_ONLY = ["/auth", "/signup"];

const ProjectRoutes = () => {
  const { currentUser, isBootstrapping } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Wait for the refresh attempt to settle before deciding anything, or a
    // signed-in user reloading the page would be bounced to /auth.
    if (isBootstrapping) return;

    if (!currentUser && !PUBLIC_PATHS.includes(location.pathname)) {
      // Tear the socket down on sign-out so it does not reconnect with a token
      // that no longer belongs to anyone.
      disconnectSocket();
      navigate("/auth", { replace: true });
    }

    if (currentUser && SIGNED_OUT_ONLY.includes(location.pathname)) {
      navigate("/", { replace: true });
    }
  }, [currentUser, isBootstrapping, location.pathname, navigate]);

  const element = useRoutes([
    // Same path, two products: marketing when signed out, the app when in.
    { path: "/", element: currentUser ? <Dashboard /> : <Landing /> },
    { path: "/auth", element: <Login /> },
    { path: "/signup", element: <Signup /> },
    { path: "/profile", element: <Profile /> },
    { path: "/new", element: <CreateRepository /> },
    { path: "/repo/:id", element: <RepositoryDetail /> },
    { path: "*", element: <NotFound /> },
  ]);

  if (isBootstrapping) {
    return <Loading label="Loading Cairn…" />;
  }

  return element;
};

export default ProjectRoutes;
