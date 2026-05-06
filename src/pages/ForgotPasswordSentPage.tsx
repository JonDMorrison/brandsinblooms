import { useLocation } from "react-router-dom";
import { AuthButton, AuthCard, AuthLayout } from "@/components/auth";

const getEmailFromLocationState = (state: unknown) => {
  if (!state || typeof state !== "object" || !("email" in state)) {
    return "";
  }

  const email = (state as { email?: unknown }).email;
  return typeof email === "string" ? email.trim() : "";
};

const SentEmailIllustration = () => (
  <div
    className="auth-sent-illustration auth-recovery-scale auth-recovery-delay-0"
    aria-hidden="true"
  >
    <svg className="auth-sent-envelope" viewBox="0 0 96 96" focusable="false">
      <rect
        className="auth-sent-envelope__body"
        x="18"
        y="30"
        width="60"
        height="42"
        rx="8"
      />
      <path className="auth-sent-envelope__flap" d="M21 35 48 54 75 35" />
      <path className="auth-sent-envelope__fold" d="M21 69 41 51" />
      <path className="auth-sent-envelope__fold" d="M75 69 55 51" />
      <g className="auth-sent-check">
        <circle cx="70" cy="27" r="12" />
        <path d="m64.5 27.2 3.4 3.4 7-7" />
      </g>
    </svg>
    <span className="auth-sent-particle auth-sent-particle--one" />
    <span className="auth-sent-particle auth-sent-particle--two" />
    <span className="auth-sent-particle auth-sent-particle--three" />
    <span className="auth-sent-particle auth-sent-particle--four" />
  </div>
);

export const ForgotPasswordSentPage = () => {
  const location = useLocation();
  const email = getEmailFromLocationState(location.state);

  return (
    <AuthLayout>
      <AuthCard>
        <div className="auth-recovery-content auth-recovery-content--sent">
          <SentEmailIllustration />

          <div className="auth-sent-copy">
            <h1 className="auth-recovery-heading auth-recovery-fade auth-recovery-delay-400">
              Check your email
            </h1>
            <div className="auth-sent-recipient auth-recovery-fade auth-recovery-delay-500">
              <p>We sent a password reset link to</p>
              {email ? <strong>{email}</strong> : null}
            </div>
            <p className="auth-sent-secondary auth-recovery-fade auth-recovery-delay-600">
              Didn't receive it? Check your spam folder or try again.
            </p>
          </div>

          <div className="auth-sent-actions auth-recovery-slide-up auth-recovery-delay-700">
            <AuthButton href="/auth#signin">Back to Sign In</AuthButton>
            <AuthButton href="/forgot-password" variant="ghost">
              Try Again
            </AuthButton>
          </div>
        </div>
      </AuthCard>
    </AuthLayout>
  );
};
