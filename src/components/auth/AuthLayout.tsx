import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import bloomsuiteLogo from "@/assets/bloomsuite-logo-correct.png";
import { useDeviceTier } from "@/components/homepage-three/performance/useDeviceTier";
import { AuthNanoLeafParticles } from "./AuthNanoLeafParticles";
import "./auth.css";

export type AuthLayoutContentSize = "form" | "onboarding";

interface AuthLayoutProps {
  children: ReactNode;
  contentSize?: AuthLayoutContentSize;
  headerAction?: ReactNode;
  showHomeLink?: boolean;
}

export const AuthLayout = ({
  children,
  contentSize = "form",
  headerAction,
  showHomeLink = true,
}: AuthLayoutProps) => {
  const { tier } = useDeviceTier();

  return (
    <main className="auth-shell auth-token-scope">
      <div className="auth-layout__glow" aria-hidden="true" />
      <AuthNanoLeafParticles tier={tier} />

      <header className="auth-layout__header">
        <Link
          to="/"
          className="auth-layout__brand"
          aria-label="BloomSuite home"
        >
          <img
            src={bloomsuiteLogo}
            alt=""
            className="auth-layout__logo"
          />
          <span className="auth-layout__wordmark">BloomSuite</span>
        </Link>
        {headerAction ??
          (showHomeLink ? (
            <Link to="/" className="auth-layout__home-link">
              Back to Home
            </Link>
          ) : null)}
      </header>

      <div className="auth-layout__content-wrap">
        <div
          className={`auth-layout__content auth-layout__content--${contentSize}`}
        >
          {children}
        </div>
      </div>

      <footer className="auth-layout__footer">
        <div className="auth-layout__footer-inner">
          <span>© 2026 BloomSuite</span>
          <span className="auth-layout__footer-separator">•</span>
          <Link to="/privacy">Privacy Policy</Link>
          <span className="auth-layout__footer-separator">•</span>
          <Link to="/terms">Terms of Service</Link>
        </div>
      </footer>
    </main>
  );
};
