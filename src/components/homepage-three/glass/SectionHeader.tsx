import type { HTMLAttributes } from "react";
import { joinClassNames } from "./utils";
import "./glass.css";

export interface SectionHeaderProps extends HTMLAttributes<HTMLDivElement> {
  eyebrow: string;
  headline: string;
  subtext: string;
  align?: "left" | "center";
  className?: string;
  isActive?: boolean;
}

export const SectionHeader = ({
  eyebrow,
  headline,
  subtext,
  align = "center",
  className,
  isActive = true,
  ...props
}: SectionHeaderProps) => (
  <div
    className={joinClassNames(
      "hp-section-header",
      `hp-section-header--${align}`,
      className,
    )}
    data-active={isActive}
    {...props}
  >
    <p className="hp-section-header__eyebrow">{eyebrow}</p>
    <h2 className="hp-section-header__headline">{headline}</h2>
    <p className="hp-section-header__subtext">{subtext}</p>
  </div>
);
