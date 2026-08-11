import { Link } from "react-router-dom";
import { CairnMark, CairnIllustration } from "../ui/CairnMark";
import "./auth.css";

/**
 * Shared shell for sign-in and sign-up.
 *
 * The left panel exists so the first screen anyone sees explains what they are
 * signing into; it collapses away entirely below 860px where a form alone is
 * the right answer.
 */
const AuthLayout = ({ title, subtitle, children, footer }) => (
  <div className="auth-page">
    <aside className="auth-aside">
      <Link to="/" className="auth-aside-brand">
        <CairnMark size={26} />
        <span>Cairn</span>
      </Link>

      <div className="auth-aside-copy">
        <h2>
          Every commit is <em>another stone</em> on the pile.
        </h2>
        <p>
          Snapshot your work, stack it up, and leave a trail anyone can follow.
        </p>
      </div>

      <div className="auth-aside-art" aria-hidden="true">
        <CairnIllustration size={280} />
      </div>
    </aside>

    <main className="auth-main">
      <Link to="/" className="auth-mobile-brand">
        <CairnMark size={24} />
        <span>Cairn</span>
      </Link>

      <div className="auth-heading">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>

      {children}

      {footer}
    </main>
  </div>
);

export default AuthLayout;
