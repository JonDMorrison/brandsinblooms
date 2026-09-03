import { SimplifiedOnboardingFlow } from "@/components/onboarding/SimplifiedOnboardingFlow";
import { OnboardingFlow } from "@/components/OnboardingFlow";
import { EnhancedErrorBoundary } from "@/components/onboarding/EnhancedErrorBoundary";
import { useAuth } from "@/contexts/AuthContext";
import { useOnboardingStatus } from "@/contexts/OnboardingStatusContext";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { LogOut } from "lucide-react";
import { AuthButton, AuthCard, AuthLayout } from "@/components/auth";

type OnboardingStep = "flow" | "complete";

const OnboardingPage = () => {
  const { user, loading, signOut } = useAuth();
  const {
    isCompleted,
    hasEverCompleted,
    isLoading: onboardingLoading,
    refreshStatus,
    markAsCompleted,
  } = useOnboardingStatus();
  const navigate = useNavigate();

  const [step, setStep] = useState<OnboardingStep>("flow");
  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth", { replace: true });
    }
  }, [user, loading, navigate]);

  // FIX: M2 - Redirect completed users to dashboard (also catches manual /onboarding visits via hasEverCompleted)
  useEffect(() => {
    if (
      !loading &&
      !onboardingLoading &&
      user &&
      (isCompleted || hasEverCompleted) &&
      step === "flow"
    ) {
      navigate("/dashboard", { replace: true });
    }
  }, [
    user,
    loading,
    onboardingLoading,
    isCompleted,
    hasEverCompleted,
    navigate,
    step,
  ]);

  const handleOnboardingComplete = async (data: unknown) => {
    if (!user) {
      console.error(
        "❌ OnboardingPage: No user found during onboarding completion",
      );
      navigate("/auth", { replace: true });
      return;
    }

    try {
      localStorage.setItem(
        `garden-center-onboarding-${user.id}`,
        JSON.stringify(data),
      );

      // Safety net: markAsCompleted sets localStorage synchronously so the
      // OnboardingGuard never redirects back. The DB flag (onboarding_completed_at)
      // is set asynchronously by the finalize-onboarding edge function called
      // from createCompanyProfileFromOnboarding in the background.
      markAsCompleted();

      setStep("complete");
    } catch (error) {
      console.error("OnboardingPage: Error during completion:", error);
      throw error;
    }
  };

  const handleReset = () => {
    if (user) {
      localStorage.removeItem(`garden-center-onboarding-${user.id}`);
    }
  };

  const renderOnboardingShell = (children: ReactNode) => (
    <AuthLayout
      contentSize="onboarding"
      showHomeLink={false}
      headerAction={
        <AuthButton
          type="button"
          variant="ghost"
          size="sm"
          fullWidth={false}
          className="auth-onboarding-signout"
          onClick={() => {
            void signOut();
          }}
        >
          <LogOut aria-hidden="true" />
          Sign Out
        </AuthButton>
      }
    >
      {children}
    </AuthLayout>
  );

  const renderCompletionState = () =>
    renderOnboardingShell(
      <AuthCard>
        <div className="auth-onboarding-complete">
          <svg
            className="auth-onboarding-complete__check"
            viewBox="0 0 64 64"
            role="img"
            aria-labelledby="onboarding-complete-title"
            focusable="false"
          >
            <title id="onboarding-complete-title">Setup complete</title>
            <circle
              className="auth-onboarding-complete__circle"
              cx="32"
              cy="32"
              r="30"
            />
            <path
              className="auth-onboarding-complete__mark"
              d="M20.5 33.5 28.2 41 44.5 24"
            />
          </svg>
          <div className="auth-onboarding-complete__copy">
            <h1>You're all set!</h1>
            <p>Your BloomSuite store is ready. Let's explore your dashboard.</p>
          </div>
          <div className="auth-onboarding-complete__actions">
            <AuthButton
              onClick={() => {
                markAsCompleted();
                navigate("/dashboard", { replace: true });
              }}
            >
              Go to Dashboard
            </AuthButton>
            <AuthButton
              variant="ghost"
              onClick={() => {
                markAsCompleted();
                navigate("/crm/settings/email-sending", { replace: true });
              }}
            >
              Set Up Custom Domain
            </AuthButton>
          </div>
        </div>
      </AuthCard>,
    );

  // Loading state
  if (loading || onboardingLoading) {
    return renderOnboardingShell(
      <AuthCard>
        <div className="auth-onboarding-loading">
          <span
            className="auth-spinner auth-onboarding-loading__spinner"
            aria-hidden="true"
          />
          <p>Loading...</p>
        </div>
      </AuthCard>,
    );
  }

  if (!user) {
    return null;
  }

  // Step: Complete — success screen
  if (step === "complete") {
    return renderCompletionState();
  }

  // Step: Flow — show onboarding wizard
  const isManualFlow = window.location.pathname === "/onboarding/manual";

  return renderOnboardingShell(
    <EnhancedErrorBoundary onReset={handleReset}>
      {isManualFlow ? (
        <OnboardingFlow onComplete={handleOnboardingComplete} />
      ) : (
        <SimplifiedOnboardingFlow onComplete={handleOnboardingComplete} />
      )}
    </EnhancedErrorBoundary>,
  );
};

export default OnboardingPage;
