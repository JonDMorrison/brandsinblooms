// src/components/publish/preview/useAspectInfo.ts
export function getAspectHint(naturalW: number, naturalH: number):
  | "1:1" | "4:5" | "16:9" | "other" {
  const r = +(naturalW / naturalH).toFixed(2);
  if (Math.abs(r - 1) < 0.05) return "1:1";
  if (Math.abs(r - 0.8) < 0.05) return "4:5";     // 0.8 = 4/5 portrait
  if (Math.abs(r - 1.78) < 0.05) return "16:9";   // 1.78 = 16/9
  return "other";
}

// soft rules for preview chips
export function getValidationFor(platform: "instagram"|"facebook", opts: {
  captionLen: number; aspectHint: ReturnType<typeof getAspectHint>;
}) {
  const warns: string[] = [];
  const errors: string[] = [];
  if (platform === "instagram") {
    if (opts.captionLen > 2200) errors.push("Caption exceeds Instagram's 2,200 character limit.");
    if (!["1:1", "4:5"].includes(opts.aspectHint))
      warns.push("For Instagram feed, 1:1 or 4:5 fills the screen best.");
  } else {
    // Facebook is lenient; just warn on tiny cropped wides
    if (opts.captionLen > 63206) errors.push("Caption too long for Facebook.");
  }
  return { warns, errors };
}