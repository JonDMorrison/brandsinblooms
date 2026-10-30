import { describe, expect, it } from "vitest";
import { showIdealReportNotice } from "./idealNoticeScope";

describe("Ideal report notice scope", () => {
  const westCoast = "c190325a-5da0-49f6-b374-187464762021";
  it("appears for West Coast Gardens and never another tenant", () => {
    expect(showIdealReportNotice(westCoast, false, false, null, false)).toBe(true);
    expect(showIdealReportNotice("another-tenant", false, false, null, false)).toBe(false);
    expect(showIdealReportNotice(undefined, false, false, null, false)).toBe(false);
    expect(showIdealReportNotice(westCoast, true, false, null, false)).toBe(false);
  });
  it("hides immediately while an admin switches tenants or context hydrates", () => {
    expect(showIdealReportNotice(westCoast, false, true, westCoast, true)).toBe(true);
    expect(showIdealReportNotice(westCoast, false, true, "another-tenant", true)).toBe(false);
    expect(showIdealReportNotice(westCoast, false, true, westCoast, false)).toBe(false);
  });
});
