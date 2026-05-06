import { useEffect, useState } from "react";
import type { CSSProperties, FormEvent, ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  AuthAlert,
  AuthButton,
  AuthCard,
  AuthInput,
  AuthLayout,
  AuthPasswordStrength,
  AuthTabGroup,
} from "@/components/auth";
import { Building2, Leaf, Lock, Mail, User } from "lucide-react";

type AuthMode = "signin" | "signup";
type SignInField = "email" | "password";
type SignUpField = "fullName" | "companyName" | "email" | "password";

interface SignInFormState {
  email: string;
  password: string;
}

interface SignUpFormState {
  fullName: string;
  companyName: string;
  email: string;
  password: string;
}

interface AuthAlertState {
  variant: "error" | "success";
  content: ReactNode;
}

const getModeFromHash = (hash: string): AuthMode =>
  hash === "#signup" ? "signup" : "signin";

const getEntryStyle = (delayMs: number) =>
  ({ "--auth-entry-delay": `${delayMs}ms` }) as CSSProperties;

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

const mapSignInError = (error: unknown) => {
  const message = getErrorText(error);

  if (/invalid login credentials/i.test(message)) {
    return "The email or password you entered is incorrect.";
  }

  if (/email not confirmed/i.test(message)) {
    return "Please check your inbox and confirm your email before signing in.";
  }

  if (isConnectionError(message)) {
    return "Unable to connect. Please check your internet connection.";
  }

  return "Something went wrong. Please try again.";
};

const validateSignIn = (form: SignInFormState) => ({
  email: form.email.trim() ? undefined : "Email is required",
  password: form.password ? undefined : "Password is required",
});

const validateSignUp = (form: SignUpFormState) => ({
  fullName: form.fullName.trim() ? undefined : "Full name is required",
  companyName: form.companyName.trim() ? undefined : "Company name is required",
  email: form.email.trim() ? undefined : "Email is required",
  password: !form.password
    ? "Password is required"
    : form.password.length < 6
      ? "Password must be at least 6 characters"
      : undefined,
});

export const AuthPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<AuthMode>(() =>
    getModeFromHash(location.hash),
  );
  const [displayedMode, setDisplayedMode] = useState<AuthMode>(mode);
  const [isSwitchingMode, setIsSwitchingMode] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [alert, setAlert] = useState<AuthAlertState | null>(null);
  const [signInForm, setSignInForm] = useState<SignInFormState>({
    email: "",
    password: "",
  });
  const [signUpForm, setSignUpForm] = useState<SignUpFormState>({
    fullName: "",
    companyName: "",
    email: "",
    password: "",
  });
  const [signInTouched, setSignInTouched] = useState<
    Record<SignInField, boolean>
  >({
    email: false,
    password: false,
  });
  const [signUpTouched, setSignUpTouched] = useState<
    Record<SignUpField, boolean>
  >({
    fullName: false,
    companyName: false,
    email: false,
    password: false,
  });
  const [signInSubmitted, setSignInSubmitted] = useState(false);
  const [signUpSubmitted, setSignUpSubmitted] = useState(false);
  const [signUpSuccess, setSignUpSuccess] = useState(false);

  const signInValidation = validateSignIn(signInForm);
  const signUpValidation = validateSignUp(signUpForm);
  const signInErrors = {
    email:
      signInTouched.email || signInSubmitted
        ? signInValidation.email
        : undefined,
    password:
      signInTouched.password || signInSubmitted
        ? signInValidation.password
        : undefined,
  };

  const signUpErrors = {
    fullName:
      signUpTouched.fullName || signUpSubmitted
        ? signUpValidation.fullName
        : undefined,
    companyName:
      signUpTouched.companyName || signUpSubmitted
        ? signUpValidation.companyName
        : undefined,
    email:
      signUpTouched.email || signUpSubmitted
        ? signUpValidation.email
        : undefined,
    password:
      signUpTouched.password || signUpSubmitted
        ? signUpValidation.password
        : undefined,
  };

  useEffect(() => {
    setMode(getModeFromHash(location.hash));
  }, [location.hash]);

  useEffect(() => {
    if (mode === displayedMode) {
      return undefined;
    }

    setIsSwitchingMode(true);
    const timerId = window.setTimeout(() => {
      setDisplayedMode(mode);
      setIsSwitchingMode(false);
    }, 200);

    return () => window.clearTimeout(timerId);
  }, [displayedMode, mode]);

  useEffect(() => {
    const message = (location.state as { message?: string } | null)?.message;

    if (message) {
      setAlert({ variant: "success", content: message });
      navigate(
        {
          pathname: "/auth",
          hash: location.hash,
        },
        { replace: true, state: {} },
      );
    }
  }, [location.hash, location.state, navigate]);

  const handleModeChange = (nextMode: AuthMode) => {
    if (nextMode === mode) {
      return;
    }

    setAlert(null);
    navigate({
      pathname: location.pathname,
      search: location.search,
      hash: `#${nextMode}`,
    });
  };

  const handleSignInFieldBlur = (field: SignInField) => {
    setSignInTouched((current) => ({ ...current, [field]: true }));
  };

  const handleSignUpFieldBlur = (field: SignUpField) => {
    setSignUpTouched((current) => ({ ...current, [field]: true }));
  };

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setSignInSubmitted(true);
    setAlert(null);

    const errors = validateSignIn(signInForm);
    if (errors.email || errors.password) {
      return;
    }

    const email = signInForm.email.trim();
    const password = signInForm.password;

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setAlert({ variant: "error", content: mapSignInError(error) });
      } else if (data.user) {
        navigate("/dashboard");
      }
    } catch (error) {
      setAlert({ variant: "error", content: mapSignInError(error) });
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();
    setSignUpSubmitted(true);
    setAlert(null);

    const errors = validateSignUp(signUpForm);
    if (
      errors.fullName ||
      errors.companyName ||
      errors.email ||
      errors.password
    ) {
      return;
    }

    const email = signUpForm.email.trim();
    const password = signUpForm.password;
    const fullName = signUpForm.fullName.trim();
    const companyName = signUpForm.companyName.trim();

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            company_name: companyName,
          },
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (error) {
        const message = getErrorText(error);

        if (/password .+ at least 6 characters/i.test(message)) {
          setSignUpTouched((current) => ({ ...current, password: true }));
          setSignUpSubmitted(true);
        } else if (/user already registered/i.test(message)) {
          setAlert({
            variant: "error",
            content: (
              <>
                An account with this email already exists.{" "}
                <button
                  type="button"
                  className="auth-alert-link"
                  onClick={() => handleModeChange("signin")}
                >
                  Sign In
                </button>
                .
              </>
            ),
          });
        } else if (isConnectionError(message)) {
          setAlert({
            variant: "error",
            content: "Unable to connect.",
          });
        } else {
          setAlert({
            variant: "error",
            content: "Something went wrong. Please try again.",
          });
        }
      } else if (data.user) {
        try {
          await supabase.functions.invoke("send-admin-notification", {
            body: {
              type: "trial_signup",
              user_id: data.user.id,
              user_email: data.user.email || email,
              user_name: fullName,
              company_name: companyName,
            },
          });
        } catch (notifError) {
          console.error("Failed to send admin notification:", notifError);
        }

        if (data.user.email_confirmed_at) {
          navigate("/onboarding");
        } else {
          setSignUpSuccess(true);
          setAlert({
            variant: "success",
            content:
              "Account created! Please check your email to verify your account.",
          });
        }
      }
    } catch (error) {
      const message = getErrorText(error);
      setAlert({
        variant: "error",
        content: isConnectionError(message)
          ? "Unable to connect."
          : "Something went wrong. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const renderAlert = () =>
    alert ? (
      <AuthAlert variant={alert.variant} onDismiss={() => setAlert(null)}>
        {alert.content}
      </AuthAlert>
    ) : null;

  const renderSignInForm = () => (
    <div className="auth-mode-content">
      <div className="auth-mode-copy">
        <h1 className="auth-form-heading auth-stagger" style={getEntryStyle(0)}>
          Welcome back
        </h1>
        <p
          className="auth-form-subheading auth-stagger"
          style={getEntryStyle(100)}
        >
          Sign in to your BloomSuite account
        </p>
      </div>

      {renderAlert()}

      <form
        className="auth-form auth-form--signin"
        onSubmit={handleSignIn}
        noValidate
      >
        <div className="auth-form-fields auth-form-fields--signin">
          <div className="auth-stagger" style={getEntryStyle(200)}>
            <AuthInput
              id="signin-email"
              label="Email"
              type="email"
              placeholder="you@company.com"
              value={signInForm.email}
              onBlur={() => handleSignInFieldBlur("email")}
              onChange={(e) => {
                setSignInForm((current) => ({
                  ...current,
                  email: e.target.value,
                }));
                setAlert(null);
              }}
              icon={<Mail aria-hidden="true" />}
              error={signInErrors.email}
              disabled={loading}
              autoComplete="email"
              required
            />
          </div>

          <div className="auth-stagger" style={getEntryStyle(300)}>
            <AuthInput
              id="signin-password"
              label="Password"
              type="password"
              placeholder="Enter your password"
              value={signInForm.password}
              onBlur={() => handleSignInFieldBlur("password")}
              onChange={(e) => {
                setSignInForm((current) => ({
                  ...current,
                  password: e.target.value,
                }));
                setAlert(null);
              }}
              icon={<Lock aria-hidden="true" />}
              error={signInErrors.password}
              disabled={loading}
              autoComplete="current-password"
              required
            />
          </div>
        </div>

        <div
          className="auth-signin-options auth-stagger"
          style={getEntryStyle(350)}
        >
          <label className="auth-checkbox-control">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              disabled={loading}
            />
            <span className="auth-checkbox-control__box" aria-hidden="true" />
            <span>Remember me</span>
          </label>
          <Link to="/forgot-password" className="auth-inline-link">
            Forgot password?
          </Link>
        </div>

        <div className="auth-stagger" style={getEntryStyle(400)}>
          <AuthButton type="submit" loading={loading}>
            Sign In
          </AuthButton>
        </div>
      </form>
    </div>
  );

  const renderSignUpForm = () => (
    <div className="auth-mode-content">
      <div className="auth-mode-copy">
        <h1 className="auth-form-heading auth-stagger" style={getEntryStyle(0)}>
          Create your account
        </h1>
        <p
          className="auth-form-subheading auth-stagger"
          style={getEntryStyle(100)}
        >
          Start growing your green business with AI
        </p>
      </div>

      {renderAlert()}

      <form
        className={`auth-form auth-form--signup${signUpSuccess ? " auth-form--dimmed" : ""}`}
        onSubmit={handleSignUp}
        noValidate
      >
        <div className="auth-form-fields auth-form-fields--signup">
          <div className="auth-stagger" style={getEntryStyle(180)}>
            <AuthInput
              id="signup-name"
              label="Full Name"
              type="text"
              placeholder="Your full name"
              value={signUpForm.fullName}
              onBlur={() => handleSignUpFieldBlur("fullName")}
              onChange={(e) => {
                setSignUpForm((current) => ({
                  ...current,
                  fullName: e.target.value,
                }));
                setAlert(null);
                setSignUpSuccess(false);
              }}
              icon={<User aria-hidden="true" />}
              error={signUpErrors.fullName}
              disabled={loading}
              autoComplete="name"
              required
            />
          </div>

          <div className="auth-stagger" style={getEntryStyle(250)}>
            <AuthInput
              id="company-name"
              label="Company Name"
              type="text"
              placeholder="Your garden centre or business"
              value={signUpForm.companyName}
              onBlur={() => handleSignUpFieldBlur("companyName")}
              onChange={(e) => {
                setSignUpForm((current) => ({
                  ...current,
                  companyName: e.target.value,
                }));
                setAlert(null);
                setSignUpSuccess(false);
              }}
              icon={<Building2 aria-hidden="true" />}
              error={signUpErrors.companyName}
              disabled={loading}
              required
            />
          </div>

          <div className="auth-stagger" style={getEntryStyle(320)}>
            <AuthInput
              id="signup-email"
              label="Email"
              type="email"
              placeholder="you@company.com"
              value={signUpForm.email}
              onBlur={() => handleSignUpFieldBlur("email")}
              onChange={(e) => {
                setSignUpForm((current) => ({
                  ...current,
                  email: e.target.value,
                }));
                setAlert(null);
                setSignUpSuccess(false);
              }}
              icon={<Mail aria-hidden="true" />}
              error={signUpErrors.email}
              disabled={loading}
              autoComplete="email"
              required
            />
          </div>

          <div className="auth-stagger" style={getEntryStyle(390)}>
            <AuthInput
              id="signup-password"
              label="Password"
              type="password"
              placeholder="Min. 6 characters"
              value={signUpForm.password}
              onBlur={() => handleSignUpFieldBlur("password")}
              onChange={(e) => {
                setSignUpForm((current) => ({
                  ...current,
                  password: e.target.value,
                }));
                setAlert(null);
                setSignUpSuccess(false);
              }}
              icon={<Lock aria-hidden="true" />}
              error={signUpErrors.password}
              disabled={loading}
              minLength={6}
              autoComplete="new-password"
              required
            />
            <AuthPasswordStrength password={signUpForm.password} />
          </div>
        </div>

        <p className="auth-terms auth-stagger" style={getEntryStyle(450)}>
          By creating an account, you agree to our{" "}
          <Link to="/terms">Terms of Service</Link> and{" "}
          <Link to="/privacy">Privacy Policy</Link>.
        </p>

        <div className="auth-stagger" style={getEntryStyle(420)}>
          <AuthButton type="submit" loading={loading}>
            Create Account
          </AuthButton>
        </div>
      </form>
    </div>
  );

  return (
    <AuthLayout>
      <div className="auth-page-shell">
        <AuthCard className="auth-page-card">
          <div className="auth-content-panel auth-content-panel--auth-page">
            <AuthTabGroup<AuthMode>
              ariaLabel="Authentication mode"
              value={mode}
              onValueChange={handleModeChange}
              options={[
                { value: "signin", label: "Sign In" },
                { value: "signup", label: "Sign Up" },
              ]}
            />

            <div
              className={`auth-mode-panel ${isSwitchingMode ? "auth-mode-panel--exiting" : "auth-mode-panel--entering"}`}
            >
              {displayedMode === "signin"
                ? renderSignInForm()
                : renderSignUpForm()}
            </div>
          </div>
        </AuthCard>

        <div className="auth-social-proof">
          <Leaf aria-hidden="true" />
          <span>Trusted by 200+ green businesses</span>
        </div>
      </div>
    </AuthLayout>
  );
};
