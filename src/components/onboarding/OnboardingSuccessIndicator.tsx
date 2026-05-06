import { CheckCircle, Sparkles, ArrowRight } from "lucide-react";
import { AuthButton } from "@/components/auth";

interface OnboardingSuccessIndicatorProps {
  isCompleting: boolean;
  onContinue: () => void;
  step?: "saving" | "generating" | "finalizing" | "complete";
}

export const OnboardingSuccessIndicator = ({
  isCompleting,
  onContinue,
  step = "saving",
}: OnboardingSuccessIndicatorProps) => {
  const getStepContent = () => {
    switch (step) {
      case "saving":
        return {
          icon: <span className="auth-spinner" aria-hidden="true" />,
          title: "Saving your information...",
          description: "Setting up your profile",
        };
      case "generating":
        return {
          icon: <Sparkles className="auth-success-indicator__icon-pulse" />,
          title: "Creating your content...",
          description: "AI is generating your first week of posts",
        };
      case "finalizing":
        return {
          icon: <span className="auth-spinner" aria-hidden="true" />,
          title: "Finishing setup...",
          description: "Almost ready!",
        };
      case "complete":
        return {
          icon: <CheckCircle className="auth-success-indicator__icon" />,
          title: "Setup Complete!",
          description: "Your content is ready to review",
        };
    }
  };

  const content = getStepContent();

  if (!isCompleting && step !== "complete") {
    return null;
  }

  return (
    <div className="auth-success-indicator" role="status" aria-live="polite">
      <div className="auth-success-indicator__card">
        <div className="auth-success-indicator__bubble">{content.icon}</div>

        <h3>{content.title}</h3>

        <p>{content.description}</p>

        {step === "complete" && (
          <AuthButton onClick={onContinue}>
            View Your Content
            <ArrowRight aria-hidden="true" />
          </AuthButton>
        )}
      </div>
    </div>
  );
};
