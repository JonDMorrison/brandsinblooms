import * as React from "react";
import {
  BloomMarkdown,
  type BloomMarkdownVariant,
} from "@/components/bloom/BloomMarkdown";

export const BloomTextBlock = React.memo(function BloomTextBlock({
  compact,
  content,
  variant,
}: {
  compact?: boolean;
  content: string;
  variant?: BloomMarkdownVariant;
}) {
  return <BloomMarkdown compact={compact} content={content} variant={variant} />;
});
