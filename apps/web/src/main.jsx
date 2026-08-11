import ReactDOM from "react-dom/client";
import { BrowserRouter as Router } from "react-router-dom";
import "./index.css";
import { AuthProvider } from "./auth";
import { ToastProvider } from "./components/ui/ToastProvider";
import ProjectRoutes from "./Routes.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <AuthProvider>
    <ToastProvider>
      <Router>
        <ProjectRoutes />
      </Router>
    </ToastProvider>
  </AuthProvider>
);
