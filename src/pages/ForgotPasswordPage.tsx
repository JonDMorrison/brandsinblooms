import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, KeyRound, Mail } from "lucide-react";
import {
  AuthAlert,
  AuthButton,
  AuthCard,
  AuthInput,
  AuthLayout,
} from "@/components/auth";
import { supabase } from "@/integrations/supabase/client";
import { getOAuthRedirectUri } from "@/utils/environmentUtils";
import { getAuthErrorMessage } from "@/utils/authErrorMessages";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validateEmail = (value: string, requireValue = false) => {
  const email = value.trim();

  if (!email) {
    return requireValue ? "Please enter your email address" : "";
  }

  return emailPattern.test(email) ? "" : "Please enter a valid email address";
};

export const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [emailValue, setEmailValue] = useState("");
  const [emailError, setEmailError] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleEmailBlur = () => {
    setEmailError(validateEmail(emailValue));
  };

  const handleEmailChange = (nextEmail: string) => {
    setEmailValue(nextEmail);
    setSubmitError(null);

    if (emailError) {
      setEmailError(validateEmail(nextEmail, true));
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const email = emailValue.trim();
    const nextEmailError = validateEmail(email, true);

    setEmailValue(email);
    setEmailError(nextEmailError);
    setSubmitError(null);

    if (nextEmailError) {
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: getOAuthRedirectUri("/reset-password"),
      });

      if (error) {
        console.error("Password reset error:", error);

        const rawMessage = (error.message || "").toLowerCase();
        const result = getAuthErrorMessage(error, "passwordReset");

        if (
          result.code === "over_request_rate_limit" ||
          result.code === "over_email_send_rate_limit"
        ) {
          setSubmitError(result.message);
          return;
        }

        if (
          rawMessage.includes("redirect") ||
          rawMessage.includes("not allowed")
        ) {
          setSubmitError(result.message);
          return;
        }

        navigate("/forgot-password/sent", { state: { email } });
        return;
      }

      navigate("/forgot-password/sent", { state: { email } });
    } catch (error) {
      console.error("Password reset error:", error);
      setSubmitError(getAuthErrorMessage(error, "passwordReset").message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <AuthCard>
        <div className="auth-recovery-content auth-recovery-content--request">
          <AuthButton
            href="/auth#signin"
            variant="ghost"
            size="sm"
            fullWidth={false}
            className="auth-recovery-back-link auth-recovery-fade auth-recovery-delay-0"
          >
            <ArrowLeft aria-hidden="true" />
            Back to Sign In
          </AuthButton>

          <div className="auth-recovery-header">
            <div className="auth-recovery-icon auth-recovery-icon--request auth-recovery-scale auth-recovery-delay-100">
              <KeyRound aria-hidden="true" />
            </div>
            <h1 className="auth-recovery-heading auth-recovery-fade auth-recovery-delay-200">
              Forgot your password?
            </h1>
            <p className="auth-recovery-subheading auth-recovery-fade auth-recovery-delay-300">
              No worries. Enter your email and we'll send you a reset link.
            </p>
          </div>

          {submitError ? (
            <AuthAlert variant="error" onDismiss={() => setSubmitError(null)}>
              {submitError}
            </AuthAlert>
          ) : null}

          <form
            onSubmit={handleSubmit}
            className="auth-recovery-form"
            noValidate
          >
            <div className="auth-recovery-slide-up auth-recovery-delay-400">
              <AuthInput
                id="forgot-password-email"
                label="Email Address"
                type="email"
                placeholder="you@company.com"
                value={emailValue}
                onBlur={handleEmailBlur}
                onChange={(event) => handleEmailChange(event.target.value)}
                icon={<Mail aria-hidden="true" />}
                error={emailError}
                disabled={loading}
                autoComplete="email"
                required
              />
            </div>

            <div className="auth-recovery-slide-up auth-recovery-delay-500">
              <AuthButton type="submit" loading={loading} disabled={loading}>
                Send Reset Link
              </AuthButton>
            </div>
          </form>
        </div>
      </AuthCard>
    </AuthLayout>
  );
};
