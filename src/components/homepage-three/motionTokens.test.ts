import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const homepageRoot = join(process.cwd(), "src/components/homepage-three");

const collectCssFiles = (directory: string): string[] =>
  readdirSync(directory).flatMap((entry) => {
    const path = `${directory}/${entry}`;

    if (statSync(path).isDirectory()) {
      return collectCssFiles(path);
    }

    return path.endsWith(".css") ? [path] : [];
  });

const stripApprovedTimingFunctions = (declaration: string) =>
  declaration
    .replace(/var\(--hp-ease-[^)]+\)/g, "")
    .replace(/steps\([^)]*\)/g, "");

describe("homepage motion tokens", () => {
  const cssDeclarations = collectCssFiles(homepageRoot).flatMap((filePath) => {
    const text = readFileSync(filePath, "utf8");
    return Array.from(
      text.matchAll(/(?:animation|transition):[^;]+;/g),
      ([declaration]) => ({ declaration, filePath }),
    );
  });

  it("does not use default or linear animation easing in motion declarations", () => {
    for (const { declaration, filePath } of cssDeclarations) {
      expect(
        stripApprovedTimingFunctions(declaration),
        `${filePath}: ${declaration}`,
      ).not.toMatch(/\b(?:ease|ease-in|ease-out|ease-in-out|linear)\b/);
    }
  });

  it("keeps hover transition declarations on the shared 200ms token", () => {
    const transitionDeclarations = cssDeclarations.filter(({ declaration }) =>
      declaration.startsWith("transition:"),
    );

    for (const { declaration, filePath } of transitionDeclarations) {
      if (declaration === "transition: none;") {
        continue;
      }

      if (declaration.includes("500ms")) {
        expect(declaration, filePath).toContain("var(--hp-ease-entry)");
        continue;
      }

      expect(declaration, `${filePath}: ${declaration}`).toContain(
        "var(--hp-hover-duration) var(--hp-ease-hover)",
      );
      expect(declaration, `${filePath}: ${declaration}`).not.toMatch(
        /\b(?:160|180|200|220)ms\b/,
      );
    }
  });
});
