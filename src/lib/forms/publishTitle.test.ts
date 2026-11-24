import { describe, expect, it } from "vitest";
import { validateFormForPublish } from "./publish";
import { DEFAULT_FORM_SETTINGS, type FormField } from "@/types/formBuilder";

const emailField = { id: "email", type: "email", label: "Email", required: true } as FormField;

describe("publishing needs a visible title", () => {
  it("blocks publishing without a form title", () => {
    const issues = validateFormForPublish({
      name: "Garden tips newsletter",
      fields: [emailField],
      settings: { ...DEFAULT_FORM_SETTINGS, form_title: "  " },
    });
    expect(issues.map((issue) => issue.id)).toContain("missing-title");
  });

  it("allows publishing once the title is set", () => {
    const issues = validateFormForPublish({
      name: "Garden tips newsletter",
      fields: [emailField],
      settings: { ...DEFAULT_FORM_SETTINGS, form_title: "Join the garden list" },
    });
    expect(issues).toEqual([]);
  });
});
