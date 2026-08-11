import { Link } from "react-router-dom";
import {
  TerminalIcon,
  ShieldLockIcon,
  IssueOpenedIcon,
} from "@primer/octicons-react";
import Button from "./ui/Button";
import { CairnMark, CairnIllustration } from "./ui/CairnMark";
import "./landing.css";

const FEATURES = [
  {
    icon: <TerminalIcon size={18} />,
    title: "Version control from scratch",
    body: "A real CLI that snapshots your files into a .cairn directory and syncs them to S3. No git under the hood — the whole thing is implemented here.",
  },
  {
    icon: <ShieldLockIcon size={18} />,
    title: "Private by default when you want it",
    body: "Short-lived access tokens, rotating refresh tokens in httpOnly cookies, and private repositories that stay genuinely invisible to everyone else.",
  },
  {
    icon: <IssueOpenedIcon size={18} />,
    title: "Issues that stay in sync",
    body: "File issues on any repository you can see, and get notified the moment somebody opens one on yours.",
  },
];

const Landing = () => (
  <div className="landing">
    <nav className="landing-nav" aria-label="Main">
      <Link to="/" className="landing-nav-brand">
        <CairnMark size={26} />
        <span>Cairn</span>
      </Link>

      <div className="landing-nav-actions">
        <Link to="/auth">
          <Button size="sm">Sign in</Button>
        </Link>
        <Link to="/signup">
          <Button size="sm" variant="accent">
            Sign up
          </Button>
        </Link>
      </div>
    </nav>

    <header className="landing-hero">
      <div>
        <span className="landing-eyebrow">
          <CairnMark size={12} />
          Version control, from scratch
        </span>

        <h1 className="landing-title">
          Every commit is <em>another stone</em> on the pile.
        </h1>

        <p className="landing-lede">
          A cairn is a stack of stones that marks a trail — each one placed by
          somebody who came before. Cairn hosts your code the same way: snapshot
          your work, stack it up, and leave a path anyone can follow.
        </p>

        <div className="landing-cta">
          <Link to="/signup">
            <Button variant="accent" size="lg">
              Create an account
            </Button>
          </Link>
          <Link to="/auth">
            <Button size="lg">Sign in</Button>
          </Link>
        </div>

        <div className="terminal">
          <div className="terminal-bar">
            <span className="terminal-dot" />
            <span className="terminal-dot" />
            <span className="terminal-dot" />
            <span className="terminal-title">~/my-project</span>
          </div>
          <div className="terminal-body">
            <div>
              <span className="terminal-prompt">$ </span>
              <span className="terminal-cmd">cairn init</span>
            </div>
            <div className="terminal-out">Repository initialised!</div>
            <div>
              <span className="terminal-prompt">$ </span>
              <span className="terminal-cmd">cairn add </span>
              <span className="terminal-arg">index.js</span>
            </div>
            <div>
              <span className="terminal-prompt">$ </span>
              <span className="terminal-cmd">cairn commit </span>
              <span className="terminal-arg">&quot;First stone&quot;</span>
            </div>
            <div className="terminal-out">
              Commit 7c17f91e created with message: First stone
            </div>
          </div>
        </div>
      </div>

      <div className="landing-hero-art">
        <CairnIllustration size={300} animate />
      </div>
    </header>

    <section className="landing-features" aria-label="Features">
      <div className="landing-features-inner">
        {FEATURES.map((feature) => (
          <div className="feature" key={feature.title}>
            <span className="feature-icon">{feature.icon}</span>
            <h3>{feature.title}</h3>
            <p>{feature.body}</p>
          </div>
        ))}
      </div>
    </section>

    <footer className="landing-footer">
      <span>
        Cairn — a source-code host with version control built from scratch.
      </span>
      <a href="https://github.com/SujalP21/Cairn">Source</a>
    </footer>
  </div>
);

export default Landing;
