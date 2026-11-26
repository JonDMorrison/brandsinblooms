import { describe, expect, it } from "vitest";
import { isLockedDesignError, parseCampaignTemplateLock } from "./useCampaignTemplateLock";

describe("campaign template lock", () => {
  it("reads what the database returns and treats anything else as not locked", () => {
    expect(parseCampaignTemplateLock({ locked: true, templateName: "Spring", canDesign: false })).toEqual({
      locked: true, templateName: "Spring", canDesign: false,
    });
    expect(parseCampaignTemplateLock(null)).toEqual({ locked: false, templateName: null, canDesign: false });
  });
  it("recognises the database refusal", () => {
    expect(isLockedDesignError({ message: "This email uses a locked design" })).toBe(true);
    expect(isLockedDesignError({ message: "Not allowed" })).toBe(false);
  });
});
