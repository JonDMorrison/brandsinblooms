import React from "react";
import type {
  ActivityDescription as ActivityDescriptionType,
  ActivityDescriptionPart,
} from "@/types/activity";
import { cn } from "@/lib/utils";

function renderPart(part: ActivityDescriptionPart, idx: number) {
  if (part.type === "text") {
    return <span key={idx}>{part.text}</span>;
  }

  if (part.type === "link") {
    return (
      <a
        key={idx}
        href={part.href}
        target={part.target ?? "_self"}
        rel={part.target === "_blank" ? "noreferrer" : undefined}
        className="text-brand-teal hover:underline"
      >
        {part.text}
      </a>
    );
  }

  if (part.type === "mention") {
    if (part.href) {
      return (
        <a
          key={idx}
          href={part.href}
          className="text-brand-teal hover:underline"
        >
          {part.label}
        </a>
      );
    }
    return (
      <span key={idx} className="font-medium">
        {part.label}
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
