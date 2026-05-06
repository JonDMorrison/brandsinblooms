import { Check } from "lucide-react";
import type { CSSProperties } from "react";

export interface AuthStepProgressProps {
  steps: string[];
  currentStep: number;
  ariaLabel?: string;
}

export const AuthStepProgress = ({
  steps,
  currentStep,
  ariaLabel = "Onboarding progress",
}: AuthStepProgressProps) => (
  <ol
    className="auth-step-progress"
    aria-label={ariaLabel}
    style={{ "--auth-step-count": steps.length } as CSSProperties}
  >
    {steps.map((step, index) => {
      const stepNumber = index + 1;
      const isCompleted = stepNumber < currentStep;
      const isActive = stepNumber === currentStep;
      const isConnectorComplete = stepNumber <= currentStep;

      return (
        <li
          key={step}
          aria-current={isActive ? "step" : undefined}
          aria-label={`Step ${stepNumber} of ${steps.length}: ${step}`}
          className={[
            "auth-step-progress__item",
            isCompleted ? "auth-step-progress__item--completed" : "",
            isActive ? "auth-step-progress__item--active" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {index > 0 ? (
            <span
              className={`auth-step-progress__line ${isConnectorComplete ? "auth-step-progress__line--completed" : ""}`}
              aria-hidden="true"
            />
          ) : null}
          <span className="auth-step-progress__circle" aria-hidden="true">
            {isCompleted ? <Check /> : stepNumber}
          </span>
          <span className="auth-step-progress__label">{step}</span>
        </li>
      );
    })}
  </ol>
);
