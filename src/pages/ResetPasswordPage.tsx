import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  AuthAlert,
  AuthButton,
  AuthCard,
  AuthInput,
  AuthLayout,
  AuthPasswordStrength,
} from "@/components/auth";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type ResetField = "password" | "confirmPassword";

const successMessage =
  "Password reset successful. Please sign in with your new password.";

const getErrorText = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message ?? "");
  }

  return "";
};

const isConnectionError = (message: string) =>
  /network|timeout|timed out|failed to fetch|fetch failed|connection/i.test(
    message,
  );

const getResetErrorMessage = (error: unknown) =>
  isConnectionError(getErrorText(error))
    ? "Unable to connect. Please check your internet connection."
    : "Unable to update your password.";

const validatePassword = (value: string) => {
  if (!value) {
    return "Password is required";
  }

  if (value.length < 6) {
    return "Password must be at least 6 characters";
  }

  return undefined;
};

const validateConfirmPassword = (value: string, password: string) => {
  if (!value) {
    return "Please confirm your password";
  }

  if (value !== password) {
    return "Passwords don't match";
  }

  return undefined;
};

export const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const { clearRecoveryMode } = useAuth();
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isValidToken, setIsValidToken] = useState<boolean | null>(null);
  const [touched, setTouched] = useState<Record<ResetField, boolean>>({
    password: false,
    confirmPassword: false,
  });
  const [submitted, setSubmitted] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [resetSucceeded, setResetSucceeded] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);
  const successTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let resolved = false;
    let mounted = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted || resolved) return;

      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        resolved = true;
        window.history.replaceState(null, "", "/reset-password");
        setIsValidToken(true);
      }
    });

    const fallbackTimer = window.setTimeout(() => {
      if (resolved) return;

      void supabase.auth
        .getSession()
        .then(({ data: { session } }) => {
          if (!mounted || resolved) return;

          if (session?.user) {
            resolved = true;
            window.history.replaceState(null, "", "/reset-password");
            setIsValidToken(true);
          }
        })
        .catch(() => {
          if (!mounted || resolved) return;

          resolved = true;
          setIsValidToken(false);
        });
    }, 500);

    const timeout = window.setTimeout(() => {
      if (!resolved) {
        resolved = true;
        setIsValidToken(false);
      }
    }, 8000);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      window.clearTimeout(fallbackTimer);
      window.clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (successTimerRef.current) {
        window.clearTimeout(successTimerRef.current);
      }
    };
  }, []);

  const passwordError =
    touched.password || submitted ? validatePassword(password) : undefined;
  const confirmPasswordError =
    touched.confirmPassword || submitted
      ? validateConfirmPassword(confirmPassword, password)
      : undefined;
  const passwordsMatch = Boolean(
    password && confirmPassword && password === confirmPassword,
  );

  const handleFieldBlur = (field: ResetField) => {
    setTouched((current) => ({ ...current, [field]: true }));
  };

  const focusFirstInvalidField = (
    nextPasswordError?: string,
    nextConfirmPasswordError?: string,
  ) => {
    if (nextPasswordError) {
      passwordRef.current?.focus();
      return;
    }

    if (nextConfirmPasswordError) {
      confirmPasswordRef.current?.focus();
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setAlertMessage(null);

    const nextPasswordError = validatePassword(password);
    const nextConfirmPasswordError = validateConfirmPassword(
      confirmPassword,
      password,
    );

    if (nextPasswordError || nextConfirmPasswordError) {
      focusFirstInvalidField(nextPasswordError, nextConfirmPasswordError);
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        setAlertMessage(getResetErrorMessage(error));
        return;
      }

      clearRecoveryMode();

      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        console.error("Password reset sign-out error:", signOutError);
      }

      setResetSucceeded(true);
      successTimerRef.current = window.setTimeout(() => {
        navigate("/auth", {
          state: {
            message: successMessage,
          },
        });
      }, 500);
    } catch (error) {
      setAlertMessage(getResetErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const renderLoadingState = () => (
    <AuthLayout>
      <AuthCard>
        <div
          className="auth-reset-state auth-reset-state--loading"
          role="status"
          aria-live="polite"
        >
          <span className="auth-reset-spinner" aria-hidden="true" />
          <p className="auth-reset-status auth-recovery-fade auth-recovery-delay-0">
            Verifying your reset link...
          </p>
        </div>
      </AuthCard>
    </AuthLayout>
  );

  const renderInvalidState = () => (
    <AuthLayout>
      <AuthCard>
        <div className="auth-reset-state auth-reset-state--invalid">
          <AlertTriangle
            className="auth-reset-icon auth-reset-icon--danger auth-recovery-scale auth-recovery-delay-0"
            aria-hidden="true"
          />
          <h1 className="auth-reset-heading auth-recovery-slide-up auth-recovery-delay-100">
            Link Expired
          </h1>
          <p className="auth-reset-copy auth-recovery-slide-up auth-recovery-delay-200">
            This password reset link is invalid or has expired. Please request a
            new one.
          </p>
          <div className="auth-reset-actions auth-recovery-slide-up auth-recovery-delay-300">
            <AuthButton href="/forgot-password">Request New Link</AuthButton>
            <AuthButton href="/auth#signin" variant="ghost">
              Back to Sign In
            </AuthButton>
          </div>
        </div>
      </AuthCard>
    </AuthLayout>
  );

  const renderSuccessState = () => (
    <div
      className="auth-reset-state auth-reset-state--success"
      aria-live="polite"
    >
      <CheckCircle2
        className="auth-reset-icon auth-reset-icon--success auth-recovery-scale auth-recovery-delay-0"
        aria-hidden="true"
      />
      <p className="auth-reset-success-text auth-recovery-slide-up auth-recovery-delay-100">
        Password updated!
      </p>
    </div>
  );

  const renderFormState = () => (
    <AuthLayout>
      <AuthCard>
        {resetSucceeded ? (
          renderSuccessState()
        ) : (
          <div className="auth-reset-content">
            <div className="auth-reset-header">
              <ShieldCheck
                className="auth-reset-icon auth-reset-icon--secure auth-recovery-scale auth-recovery-delay-0"
                aria-hidden="true"
              />
              <h1 className="auth-reset-heading auth-recovery-slide-up auth-recovery-delay-100">
                Set your new password
              </h1>
              <p className="auth-reset-copy auth-recovery-slide-up auth-recovery-delay-200">
                Choose a strong password for your account.
              </p>
            </div>

            {alertMessage ? (
              <AuthAlert
                variant="error"
                onDismiss={() => setAlertMessage(null)}
              >
                {alertMessage}
              </AuthAlert>
            ) : null}

            <form
              className="auth-reset-form"
              onSubmit={handleSubmit}
              noValidate
            >
              <div className="auth-recovery-slide-up auth-recovery-delay-300">
                <AuthInput
                  ref={passwordRef}
                  id="reset-password-new"
                  label="New Password"
                  type="password"
                  placeholder="Min. 6 characters"
                  value={password}
                  onBlur={() => handleFieldBlur("password")}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setAlertMessage(null);
                  }}
                  icon={<Lock aria-hidden="true" />}
                  error={passwordError}
                  disabled={loading}
                  minLength={6}
                  autoComplete="new-password"
                  passwordToggleTabIndex={0}
                  required
                />
                <AuthPasswordStrength password={password} />
              </div>

              <div className="auth-recovery-slide-up auth-recovery-delay-400">
                <AuthInput
                  ref={confirmPasswordRef}
                  id="reset-password-confirm"
                  label="Confirm Password"
                  type="password"
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onBlur={() => handleFieldBlur("confirmPassword")}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setAlertMessage(null);
                  }}
                  icon={<Lock aria-hidden="true" />}
                  error={confirmPasswordError}
                  disabled={loading}
                  minLength={6}
                  autoComplete="new-password"
                  passwordToggleTabIndex={0}
                  required
                />
                {passwordsMatch ? (
                  <p
                    className="auth-reset-match auth-reset-match--valid"
                    aria-live="polite"
                  >
                    <Check aria-hidden="true" />
                    <span>Passwords match</span>
                  </p>
                ) : null}
              </div>

              <div className="auth-recovery-slide-up auth-recovery-delay-500">
                <AuthButton type="submit" loading={loading}>
                  Reset Password
                </AuthButton>
              </div>
            </form>
          </div>
        )}
      </AuthCard>
    </AuthLayout>
  );

  if (isValidToken === null) {
    return renderLoadingState();
  }

  if (isValidToken === false) {
    return renderInvalidState();
  }

  return renderFormState();
};
