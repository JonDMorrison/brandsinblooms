import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const homepageRoot = join(process.cwd(), "src/components/homepage-three");
const tokenSource = readFileSync(
  join(homepageRoot, "homepageTokens.css"),
  "utf8",
);
const homepageSource = readFileSync(
  join(homepageRoot, "homepageThree.css"),
  "utf8",
);

describe("homepage motion tokens", () => {
  it("defines the shared duration and easing tokens used by homepage motion", () => {
    expect(tokenSource).toContain("--hp-hover-duration: 200ms");
    expect(tokenSource).toContain("--hp-entry-duration: 400ms");
    expect(tokenSource).toContain("--hp-ease-hover: cubic-bezier");
    expect(tokenSource).toContain("--hp-ease-entry: cubic-bezier");
  });

  it("provides a reduced-motion override for homepage animations", () => {
    expect(homepageSource).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
