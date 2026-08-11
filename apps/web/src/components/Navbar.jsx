import { Link } from "react-router-dom";
import "./navbar.css";

import logo from "../assets/cairn-mark-white.svg";

const Navbar = () => {
  return (
    <nav>
      <Link to="/">
        <div>
          <img src={logo} alt="Cairn Logo" />
          <h3>Cairn</h3>
        </div>
      </Link>
      <div>
        <Link to="/create">
          <p>Create a Repository</p>
        </Link>
        <Link to="/profile">
          <p>Profile</p>
        </Link>
      </div>
    </nav>
  );
};

export default Navbar;
