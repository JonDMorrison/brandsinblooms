import * as React from "react";
import Typography from "@mui/joy/Typography";

/**
 * "chat": the Bloom workspace reading style (16px). "panel": the Ask Bloom
 * drawer's denser 14px style.
 */
export type BloomMarkdownVariant = "chat" | "panel";

export interface BloomMarkdownProps {
  content: string;
  compact?: boolean;
  variant?: BloomMarkdownVariant;
}

const BloomMarkdownRenderer = React.lazy(
  () => import("@/components/bloom/BloomMarkdownRenderer"),
);

function BloomMarkdownFallback({
  compact = false,
  content,
  variant = "chat",
}: BloomMarkdownProps) {
  if (variant === "panel") {
    return (
      <Typography
        component="div"
        level="body-md"
        sx={{
          color: "text.primary",
          fontSize: "14px",
          lineHeight: 1.6,
          overflowWrap: "anywhere",
          whiteSpace: "pre-wrap",
        }}
      >
        {content}
      </Typography>
    );
  }

  return (
    <Typography
      component="div"
      level="body-md"
      sx={{
        color: "neutral.700",
        fontSize: "16px",
        lineHeight: compact ? 1.55 : 1.65,
        overflowWrap: "anywhere",
        whiteSpace: "pre-wrap",
      }}
    >
      {content}
    </Typography>
  );
}

export const BloomMarkdown = React.memo(function BloomMarkdown(
  props: BloomMarkdownProps,
) {
  return (
    <React.Suspense fallback={<BloomMarkdownFallback {...props} />}>
      <BloomMarkdownRenderer {...props} />
    </React.Suspense>
  );
}, areBloomMarkdownPropsEqual);

function areBloomMarkdownPropsEqual(
  previous: BloomMarkdownProps,
  next: BloomMarkdownProps,
) {
  return (
    previous.compact === next.compact &&
    previous.content === next.content &&
    previous.variant === next.variant
  );
}
