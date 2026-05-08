import type { ReactNode } from "react";
import { Link } from "react-router-dom";
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

const BloomSuiteMark = () => (
  <svg
    className="auth-layout__logo"
    viewBox="0 0 40 40"
    role="img"
    aria-labelledby="auth-logo-title"
    focusable="false"
  >
    <title id="auth-logo-title">BloomSuite</title>
    <defs>
      <linearGradient id="auth-logo-gradient" x1="8" y1="32" x2="32" y2="8">
        <stop stopColor="#3E7C77" />
        <stop offset="1" stopColor="#87DFD8" />
      </linearGradient>
    </defs>
    <rect width="40" height="40" rx="12" fill="#E1FFFE" />
    <path
      d="M20 31c-5.7-4.28-8.55-8.8-8.55-13.56 0-4.05 2.34-7.12 5.53-7.12 1.72 0 3.02.78 3.89 2.34.86-1.56 2.16-2.34 3.89-2.34 3.19 0 5.53 3.07 5.53 7.12C30.29 22.2 26.86 26.72 20 31Z"
      fill="url(#auth-logo-gradient)"
    />
    <path
      d="M20.12 28.7c.28-4.26 1.58-8.38 3.92-12.36"
      fill="none"
      stroke="rgba(255,255,255,0.74)"
      strokeLinecap="round"
      strokeWidth="1.6"
    />
  </svg>
);

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
          <BloomSuiteMark />
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
