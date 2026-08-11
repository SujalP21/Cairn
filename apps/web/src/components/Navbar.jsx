import { Link, NavLink } from "react-router-dom";
import { PlusIcon, PersonIcon, HomeIcon } from "@primer/octicons-react";
import { CairnMark } from "./ui/CairnMark";
import "./navbar.css";

const linkClass = ({ isActive }) =>
  `navbar-link ${isActive ? "navbar-link-active" : ""}`;

const Navbar = () => (
  <header className="navbar">
    <nav className="navbar-inner" aria-label="Main">
      <Link to="/" className="navbar-brand">
        <CairnMark size={26} className="navbar-mark" />
        <span>Cairn</span>
      </Link>

      <div className="navbar-links">
        <NavLink to="/" className={linkClass} end>
          <HomeIcon size={16} />
          <span>Home</span>
        </NavLink>

        <NavLink to="/new" className={linkClass}>
          <PlusIcon size={16} />
          <span>New repository</span>
        </NavLink>

        <NavLink to="/profile" className={linkClass}>
          <PersonIcon size={16} />
          <span>Profile</span>
        </NavLink>
      </div>
    </nav>
  </header>
);

export default Navbar;
