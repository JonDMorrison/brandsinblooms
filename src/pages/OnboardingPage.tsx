import { SimplifiedOnboardingFlow } from "@/components/onboarding/SimplifiedOnboardingFlow";
import { OnboardingFlow } from "@/components/OnboardingFlow";
import { EnhancedErrorBoundary } from "@/components/onboarding/EnhancedErrorBoundary";
import { useAuth } from "@/contexts/AuthContext";
import { useOnboardingStatus } from "@/contexts/OnboardingStatusContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  CheckCircle,
  Bookmark,
  FileText,
  Mail,
  Share2,
  Video,
  Newspaper,
} from "lucide-react";
import { Button } from "@/components/ui-legacy/button";
import { Card, CardContent } from "@/components/ui-legacy/card";

interface ContentPreviewItem {
  id: string;
  post_type: string;
  title: string;
  content: string;
  status: string;
}

type OnboardingStep = "flow" | "generating" | "preview" | "complete";

const POST_TYPE_ICONS: Record<string, React.ReactNode> = {
  newsletter: <Newspaper className="w-4 h-4" />,
  email: <Mail className="w-4 h-4" />,
  instagram: <Share2 className="w-4 h-4" />,
  facebook: <Share2 className="w-4 h-4" />,
  video_script: <Video className="w-4 h-4" />,
};

const OnboardingPage = () => {
  const { user, loading } = useAuth();
  const {
    isCompleted,
    hasEverCompleted,
    isLoading: onboardingLoading,
    refreshStatus,
  } = useOnboardingStatus();
  const navigate = useNavigate();

  const [step, setStep] = useState<OnboardingStep>("flow");
  const [generatedContent, setGeneratedContent] = useState<
    ContentPreviewItem[]
  >([]);
  const [pollAttempts, setPollAttempts] = useState(0);
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

  const handleOnboardingComplete = async (data: any) => {
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

      // FIX: H2 - Do NOT call markAsCompleted() here (sets localStorage before DB write).
      // The background CompanyProfileCreator calls finalize-onboarding which sets the DB flag.
      // OnboardingStatusContext will pick it up on next refetch. We only set the cache
      // after refreshStatus confirms DB completion.
      await refreshStatus();
      // If DB says complete after refresh, the context auto-sets localStorage (line 114-118 in OnboardingStatusContext)

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

  // Loading state
  if (loading || onboardingLoading) {
    return (
      <div className="min-h-screen bg-garden-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-garden-green" />
          <p className="text-text-secondary">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Step: Generating content — show loading with progress
  if (step === "generating") {
    return (
      <div className="min-h-screen bg-garden-background flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Generating your content...
            </h1>
            <p className="text-gray-600">
              Our AI is creating personalized marketing content for your garden
              center. This usually takes 30-60 seconds.
            </p>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-1000"
              style={{
                width: `${Math.min(
                  95,
                  (pollAttempts / MAX_POLL_ATTEMPTS) * 100,
                )}%`,
              }}
            />
          </div>
          <Button
            variant="ghost"
            onClick={handleSkipPreview}
            className="text-gray-500"
          >
            Skip preview and go to dashboard
          </Button>
        </div>
      </div>
    );
  }

  // Step: Preview generated content
  if (step === "preview") {
    return (
      <div className="min-h-screen bg-garden-background flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-2xl space-y-6">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <FileText className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Your content is ready!
            </h1>
            <p className="text-gray-600">
              Here's a preview of what we created. You can edit any of these
              from your dashboard.
            </p>
          </div>

          <div className="space-y-3 max-h-[50vh] overflow-y-auto">
            {generatedContent.map((item) => (
              <Card key={item.id} className="border border-gray-200">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-gray-100 rounded-lg text-gray-600">
                      {POST_TYPE_ICONS[item.post_type] || (
                        <FileText className="w-4 h-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900 text-sm">
                          {item.title}
                        </span>
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full capitalize">
                          {item.post_type.replace("_", " ")}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {item.content}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex gap-3 justify-center">
            <Button onClick={handleApproveContent} className="px-8">
              <CheckCircle className="w-4 h-4 mr-2" />
              Looks great — continue
            </Button>
            <Button
              variant="outline"
              onClick={handleSkipPreview}
              className="text-gray-600"
            >
              I'll review later
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Step: Complete — success screen
  if (step === "complete") {
    return (
      <div className="min-h-screen bg-garden-background flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Your account is ready!
            </h1>
            <p className="text-gray-600">
              You can now access BloomSuite anytime from:
            </p>
          </div>
          <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm space-y-2">
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
              <Bookmark className="w-4 h-4" />
              <span className="font-medium">Bookmark your login page</span>
            </div>
            <code className="font-mono text-sm font-semibold text-gray-900 select-all break-words">
              https://bloomsuite.app/auth
            </code>
            <p className="text-xs text-gray-500">
              Use this URL anytime to sign in. Save it now so you always know
              where to go.
            </p>
          </div>
          {/* FIX: M3 - Show timeout message when content generation is still running */}
          {contentTimedOut && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              Your content is still being generated — check your content library
              in a few minutes.
            </div>
          )}
          <Button
            className="w-full"
            onClick={() => {
              navigate("/dashboard", { replace: true });
            }}
          >
            Go to My Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // Step: Flow — show onboarding wizard
  const isManualFlow = window.location.pathname === "/onboarding/manual";

  return (
    <EnhancedErrorBoundary onReset={handleReset}>
      <div className="min-h-screen bg-garden-background">
        {isManualFlow ? (
          <OnboardingFlow onComplete={handleOnboardingComplete} />
        ) : (
          <SimplifiedOnboardingFlow onComplete={handleOnboardingComplete} />
        )}
      </div>
    </EnhancedErrorBoundary>
  );
};

export default OnboardingPage;
