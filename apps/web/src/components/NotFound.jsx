import { Link } from "react-router-dom";
import Navbar from "./Navbar";
import Button from "./ui/Button";
import { EmptyState } from "./ui/Status";

const NotFound = () => (
  <>
    <Navbar />

    <main className="page">
      <EmptyState
        title="No trail this way"
        description="That page does not exist, or you do not have access to it."
        action={
          <Link to="/">
            <Button variant="accent">Back to your repositories</Button>
          </Link>
        }
      />
    </main>
  </>
);

export default NotFound;
