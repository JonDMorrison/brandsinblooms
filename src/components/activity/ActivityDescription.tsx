import React from "react";
import type {
  ActivityDescription as ActivityDescriptionType,
  ActivityDescriptionPart,
} from "@/types/activity";
import { cn } from "@/lib/utils";

function renderPart(part: ActivityDescriptionPart, idx: number) {
  if (part.type === "text" && "text" in part) {
    return <span key={idx}>{String(part.text)}</span>;
  }

  if (part.type === "link" && "href" in part && "text" in part) {
    const href = String(part.href);
    const text = String(part.text);
    const target = "target" in part ? String(part.target) : "_self";
    return (
      <a
        key={idx}
        href={href}
        target={target as "_self" | "_blank" | "_parent" | "_top"}
        rel={target === "_blank" ? "noreferrer" : undefined}
        className="text-brand-teal hover:underline"
      >
        {text}
      </a>
    );
  }

  if (part.type === "mention" && "label" in part) {
    const label = String(part.label);
    const href = "href" in part ? String(part.href) : undefined;
    if (href) {
      return (
        <a
          key={idx}
          href={href}
          className="text-brand-teal hover:underline"
        >
          {label}
        </a>
      );
    }
    return (
      <span key={idx} className="font-medium">
        {label}
      </span>
    );
  }

  // Unknown part: best-effort stringify
  const fallback =
    typeof part === "object" ? JSON.stringify(part) : String(part);
  return (
    <span key={idx} className="text-muted-foreground">
      {fallback}
    </span>
  );
}

export function ActivityDescription({
  description,
  className,
}: {
  description: ActivityDescriptionType;
  className?: string;
}) {
  const parts = Array.isArray(description?.parts) ? description.parts : [];

  if (!parts.length) return null;

  return (
    <div
      className={cn("text-sm text-muted-foreground leading-relaxed", className)}
    >
      {parts.map((p, idx) => (
        <React.Fragment key={idx}>{renderPart(p, idx)} </React.Fragment>
      ))}
    </div>
  );
}
