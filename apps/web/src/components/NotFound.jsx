import { Link } from "react-router-dom";
import { TelescopeIcon } from "@primer/octicons-react";
import Navbar from "./Navbar";
import Button from "./ui/Button";
import { EmptyState } from "./ui/Status";

const NotFound = () => (
  <>
    <Navbar />

    <main className="page">
      <EmptyState
        icon={<TelescopeIcon size={24} />}
        title="404 — page not found"
        description="That page does not exist, or you do not have access to it."
        action={
          <Link to="/">
            <Button variant="primary">Back to your repositories</Button>
          </Link>
        }
      />
    </main>
  </>
);

export default NotFound;
