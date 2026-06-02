import * as React from "react";
import Typography from "@mui/joy/Typography";

export interface BloomMarkdownProps {
  content: string;
  compact?: boolean;
}

const BloomMarkdownRenderer = React.lazy(
  () => import("@/components/bloom/BloomMarkdownRenderer"),
);

function BloomMarkdownFallback({
  compact = false,
  content,
}: BloomMarkdownProps) {
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
  return previous.compact === next.compact && previous.content === next.content;
}
