import * as React from "react";
import { BloomMarkdown } from "@/components/bloom/BloomMarkdown";

export const BloomTextBlock = React.memo(function BloomTextBlock({
  content,
}: {
  content: string;
}) {
  return <BloomMarkdown content={content} />;
});
