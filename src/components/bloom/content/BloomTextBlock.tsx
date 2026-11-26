import * as React from "react";
import {
  BloomMarkdown,
  type BloomMarkdownVariant,
} from "@/components/bloom/BloomMarkdown";

export const BloomTextBlock = React.memo(function BloomTextBlock({
  content,
  variant,
}: {
  content: string;
  variant?: BloomMarkdownVariant;
}) {
  return <BloomMarkdown content={content} variant={variant} />;
});
