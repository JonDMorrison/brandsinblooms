import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const css = readFileSync(
  resolve(process.cwd(), "src/components/auth/auth.css"),
  "utf8",
);

describe("auth motion tokens", () => {
  it("defines the AUTH-M06 easing contract", () => {
    expect(css).toContain("--auth-ease-entry: cubic-bezier(0.16, 1, 0.3, 1)");
    expect(css).toContain("--auth-ease-exit: cubic-bezier(0.7, 0, 0.84, 0)");
    expect(css).toContain("--auth-ease-hover: cubic-bezier(0.4, 0, 0.2, 1)");
    expect(css).toContain(
      "--auth-ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1)",
    );
  });

  it("does not use direct linear or generic ease timing in animation and transition declarations", () => {
    const motionDeclarations =
      css.match(
        /(?:animation(?:-[\w-]+)?|transition(?:-[\w-]+)?)\s*:[^;]+;/g,
      ) ?? [];
    const withoutTokenReferences = motionDeclarations
      .join("\n")
      .replace(/var\(--auth-ease-[^)]+\)/g, "")
      .replace(/--auth-ease-[\w-]+\s*:[^;]+;/g, "");

    expect(withoutTokenReferences).not.toMatch(
      /\b(?:linear|ease|ease-in|ease-out|ease-in-out)\b/,
    );
  });

  it("keeps the longest auth recovery cascade under 700ms", () => {
    expect(css).toContain(".auth-recovery-delay-700");
    expect(css).toContain("animation-delay: 440ms");
  });

  it("removes decorative motion for reduced-motion users", () => {
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain(".auth-particle-canvas");
    expect(css).toContain("animation: none !important");
    expect(css).toContain("transition: none !important");
  });
});
