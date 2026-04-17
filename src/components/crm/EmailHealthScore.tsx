import React, { useMemo, useState, useRef, useEffect } from "react";
import { ContentBlock } from "@/types/emailBuilder";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmailHealthScoreProps {
  blocks: ContentBlock[];
  subjectLine: string;
  preheaderText: string;
}

interface HealthCheck {
  label: string;
  passed: boolean;
  hint: string;
}

export const EmailHealthScore: React.FC<EmailHealthScoreProps> = ({
  blocks,
  subjectLine,
  preheaderText,
}) => {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const checks = useMemo<HealthCheck[]>(() => {
    const visibleBlocks = blocks.filter((b) => b.visible !== false);

    const hasSubject = !!subjectLine.trim() && subjectLine.trim().length <= 60;
    const hasPreview = !!preheaderText.trim();
    const hasImage = visibleBlocks.some(
      (b) =>
        b.type === "image" ||
        b.type === "graphic-hero" ||
        ((b.type === "image-text" || b.type === "email-safe-hero") && !!b.imageUrl),
    );
    const hasCta = visibleBlocks.some(
      (b) =>
        b.type === "button" ||
        !!(b.ctaText || b.buttonText),
    );
    const hasHero = visibleBlocks.some(
      (b) =>
        b.type === "header" ||
        b.type === "newsletter-header" ||
        b.type === "email-safe-hero",
    );

    return [
      {
        label: "Subject line",
        passed: hasSubject,
        hint: subjectLine.trim().length > 60
          ? "Shorten to under 60 characters — it gets cut on mobile"
          : "Add a subject line in the settings above",
      },
      {
        label: "Preview text",
        passed: hasPreview,
        hint: "Add preview text — it shows after the subject in the inbox",
      },
      {
        label: "Has an image",
        passed: hasImage,
        hint: "Add a photo — emails with images get higher engagement",
      },
      {
        label: "Has a CTA button",
        passed: hasCta,
        hint: "Add a button block — every email needs one clear action",
      },
      {
        label: "Has a header or hero",
        passed: hasHero,
        hint: "Add a header block at the top for visual impact",
      },
    ];
  }, [blocks, subjectLine, preheaderText]);

  const score = checks.filter((c) => c.passed).length;
  const total = checks.length;

  const color =
    score === total
      ? "text-green-700 bg-green-50 border-green-200"
      : score >= 3
        ? "text-amber-700 bg-amber-50 border-amber-200"
        : "text-red-700 bg-red-50 border-red-200";

  const dotColor =
    score === total ? "bg-green-500" : score >= 3 ? "bg-amber-500" : "bg-red-500";

  const statusText =
    score === total ? "Ready to send" : score >= 3 ? "Almost there" : "Needs work";

  // Don't show until there's at least one block
  if (blocks.length === 0) return null;

  return (
    <div className="relative" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors",
          color,
        )}
        title={statusText}
      >
        <span className={cn("inline-block h-2 w-2 rounded-full", dotColor)} />
        {score}/{total}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-lg border bg-popover p-3 shadow-lg">
          <p className="mb-2 text-xs font-semibold text-foreground">
            Email Health — {statusText}
          </p>
          <div className="space-y-1.5">
            {checks.map((check) => (
              <div key={check.label} className="flex items-start gap-2">
                {check.passed ? (
                  <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-green-600" />
                ) : (
                  <X className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-red-500" />
                )}
                <div>
                  <p
                    className={cn(
                      "text-xs font-medium",
                      check.passed ? "text-foreground" : "text-foreground",
                    )}
                  >
                    {check.label}
                  </p>
                  {!check.passed && (
                    <p className="text-[11px] text-muted-foreground">
                      {check.hint}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
