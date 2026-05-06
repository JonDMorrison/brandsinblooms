import type { HTMLAttributes, ReactNode } from "react";
import { joinClassNames } from "./utils";
import "./glass.css";

export interface GlassStepCardProps extends HTMLAttributes<HTMLDivElement> {
  step: number;
  stepLabel?: string;
  title: string;
  description: string;
  icon?: ReactNode;
  className?: string;
}

export const GlassStepCard = ({
  step,
  stepLabel,
  title,
  description,
  icon,
  className,
  ...props
}: GlassStepCardProps) => {
  const renderedStep = stepLabel ?? String(step);

  return (
    <div className={joinClassNames("hp-step-card", className)} {...props}>
      <div className="hp-step-card__header">
        <span
          className="hp-step-card__number"
          aria-label={`Step ${renderedStep}`}
        >
          {renderedStep}
        </span>
        {icon ? <span className="hp-step-card__icon">{icon}</span> : null}
      </div>
      <h3 className="hp-step-card__title">{title}</h3>
      <p className="hp-step-card__description">{description}</p>
    </div>
  );
};
