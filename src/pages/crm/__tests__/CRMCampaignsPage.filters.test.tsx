import { describe, expect, it } from "vitest";
import { normalizeChannelFilter, normalizeFilter } from "../CRMCampaignsPage";

describe("Mike at Arts campaign catalog preferences", () => {
  it("defaults to drafts without a URL status", () => {
    expect(normalizeFilter(null)).toBe("draft");
    expect(normalizeFilter("unrecognized")).toBe("draft");
  });

  it("allows explicitly selecting all campaigns, including sent", () => {
    expect(normalizeFilter("all")).toBe("all");
    expect(normalizeFilter("sent")).toBe("sent");
    expect(normalizeFilter("scheduled")).toBe("scheduled");
  });

  it("does not apply a campaign type filter unless selected", () => {
    expect(normalizeChannelFilter(null)).toBe("all");
    expect(normalizeChannelFilter("bad")).toBe("all");
    expect(normalizeChannelFilter("email")).toBe("email");
    expect(normalizeChannelFilter("newsletter")).toBe("newsletter");
    expect(normalizeChannelFilter("sms")).toBe("sms");
  });
});
