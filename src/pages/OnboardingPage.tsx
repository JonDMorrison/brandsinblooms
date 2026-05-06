import { SimplifiedOnboardingFlow } from "@/components/onboarding/SimplifiedOnboardingFlow";
import { OnboardingFlow } from "@/components/OnboardingFlow";
import { EnhancedErrorBoundary } from "@/components/onboarding/EnhancedErrorBoundary";
import { useAuth } from "@/contexts/AuthContext";
import { useOnboardingStatus } from "@/contexts/OnboardingStatusContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  CheckCircle,
  FileText,
  Mail,
  Share2,
  Video,
  Newspaper,
  LogOut,
} from "lucide-react";
import { AuthButton, AuthCard, AuthLayout } from "@/components/auth";

interface ContentPreviewItem {
  id: string;
  post_type: string;
  title: string;
  content: string;
  status: string;
}

type OnboardingStep = "flow" | "generating" | "preview" | "complete";

const POST_TYPE_ICONS: Record<string, ReactNode> = {
  newsletter: <Newspaper />,
  email: <Mail />,
  instagram: <Share2 />,
  facebook: <Share2 />,
  video_script: <Video />,
};

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
  const [generatedContent, setGeneratedContent] = useState<
    ContentPreviewItem[]
  >([]);
  const [, setPollAttempts] = useState(0);
  // FIX: M3 - Track whether content poll timed out so we can show a message
  const [contentTimedOut, setContentTimedOut] = useState(false);
  const MAX_POLL_ATTEMPTS = 20; // ~60 seconds at 3s intervals

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

  // FIX: H1 - Add tenant_id filter for defense-in-depth isolation
  const pollForContent = useCallback(async () => {
    if (!user) return;

    try {
      // Look up tenant_id from the user's profile for proper scoping
      const { data: profileData } = await supabase
        .from("users")
        .select("tenant_id")
        .eq("id", user.id)
        .maybeSingle();

      let query = supabase
        .from("content_tasks")
        .select("id, post_type, title, content, status")
        .eq("user_id", user.id);

      // FIX: H1 - Scope to tenant if available
      if (profileData?.tenant_id) {
        query = query.eq("tenant_id", profileData.tenant_id);
      }

      const { data: tasks, error } = await query
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) {
        console.error("Error polling content:", error);
        return;
      }

      if (tasks && tasks.length > 0) {
        setGeneratedContent(
          tasks.map((t) => ({
            id: t.id,
            post_type: t.post_type || "content",
            title: t.title || `${t.post_type || "Content"} Post`,
            content: t.content || "",
            status: t.status || "draft",
          })),
        );
        setStep("preview");
      }
    } catch (err) {
      console.error("Error polling content:", err);
    }
  }, [user]);

  useEffect(() => {
    if (step !== "generating") return;

    // Poll immediately, then every 3 seconds
    pollForContent();

    const interval = setInterval(() => {
      setPollAttempts((prev) => {
        const next = prev + 1;
        if (next >= MAX_POLL_ATTEMPTS) {
          // FIX: M3 - Mark timeout so completion screen shows appropriate message
          clearInterval(interval);
          setContentTimedOut(true);
          setStep("complete");
          return next;
        }
        pollForContent();
        return next;
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [step, pollForContent]);

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

      // Move to generating step — content is being created in the background
      setStep("generating");
    } catch (error) {
      console.error("OnboardingPage: Error during completion:", error);
      throw error;
    }
  };

  const handleApproveContent = () => {
    setStep("complete");
  };

  const handleSkipPreview = () => {
    setStep("complete");
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
          {contentTimedOut ? (
            <div className="auth-onboarding-note auth-onboarding-note--warning">
              Your content is still being generated. Check your content library
              in a few minutes.
            </div>
          ) : null}
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
                navigate("/settings/domain", { replace: true });
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

  // Step: Generating content — show loading with progress
  if (step === "generating") {
    return renderCompletionState();
  }

  // Step: Preview generated content
  if (step === "preview") {
    return renderOnboardingShell(
      <AuthCard>
        <div className="auth-onboarding-preview">
          <div className="auth-onboarding-preview__header">
            <div className="auth-icon-bubble">
              <FileText aria-hidden="true" />
            </div>
            <h1>Your content is ready!</h1>
            <p>
              Here's a preview of what we created. You can edit any of these
              from your dashboard.
            </p>
          </div>

          <div className="auth-scroll-area auth-onboarding-preview__list">
            {generatedContent.map((item) => (
              <div
                key={item.id}
                className="auth-list-card auth-onboarding-preview__item"
              >
                <div className="auth-onboarding-preview__item-grid">
                  <div className="auth-onboarding-preview__item-icon">
                    {POST_TYPE_ICONS[item.post_type] || <FileText />}
                  </div>
                  <div className="auth-onboarding-preview__item-copy">
                    <div className="auth-onboarding-preview__item-title-row">
                      <span className="auth-onboarding-preview__item-title">
                        {item.title}
                      </span>
                      <span className="auth-onboarding-preview__item-type">
                        {item.post_type.replace("_", " ")}
                      </span>
                    </div>
                    <p>{item.content}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="auth-onboarding-actions auth-onboarding-actions--center">
            <AuthButton onClick={handleApproveContent} fullWidth={false}>
              <CheckCircle aria-hidden="true" />
              Looks great - continue
            </AuthButton>
            <AuthButton
              variant="secondary"
              onClick={handleSkipPreview}
              fullWidth={false}
            >
              I'll review later
            </AuthButton>
          </div>
        </div>
      </AuthCard>,
    );
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
