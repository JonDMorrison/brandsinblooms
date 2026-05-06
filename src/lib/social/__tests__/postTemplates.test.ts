import { describe, expect, it } from "vitest";
import { findPostTemplate, postTemplates } from "../postTemplates";

describe("postTemplates", () => {
  it("exposes the documented set of templates with non-empty content", () => {
    expect(postTemplates.length).toBeGreaterThanOrEqual(3);
    for (const template of postTemplates) {
      expect(template.id).toBeTruthy();
      expect(template.title).toBeTruthy();
      expect(template.content.trim().length).toBeGreaterThan(0);
    }
  });

  it("each template has a unique id (so URL ?template= maps unambiguously)", () => {
    const ids = postTemplates.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("findPostTemplate", () => {
  it("returns the matching template by id", () => {
    const result = findPostTemplate("seasonal-tips");
    expect(result).not.toBeNull();
    expect(result?.id).toBe("seasonal-tips");
    expect(result?.content).toContain("Spring");
  });

  it("returns null for an unknown id", () => {
    expect(findPostTemplate("does-not-exist")).toBeNull();
  });

  it("returns null for null/undefined/empty input", () => {
    expect(findPostTemplate(null)).toBeNull();
    expect(findPostTemplate(undefined)).toBeNull();
    expect(findPostTemplate("")).toBeNull();
  });
});
