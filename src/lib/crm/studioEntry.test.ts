import { describe, expect, it, vi } from "vitest";
import { resolveStudioDraftId } from "./studioEntry";

describe("newsletter Design Studio entry", () => {
  it("opens an existing draft without forcing another save", async () => {
    const save = vi.fn();
    expect(await resolveStudioDraftId("existing-id", save)).toBe("existing-id");
    expect(save).not.toHaveBeenCalled();
  });
  it("creates a new draft without requiring a subject or preview", async () => {
    const save = vi.fn().mockResolvedValue("new-id");
    expect(await resolveStudioDraftId(null, save)).toBe("new-id");
    expect(save).toHaveBeenCalledOnce();
  });
  it("retries one transient creation failure and preserves the resulting ID", async () => {
    const save = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce("recovered-id");
    expect(await resolveStudioDraftId(null, save)).toBe("recovered-id");
    expect(save).toHaveBeenCalledTimes(2);
  });
  it("returns null when persistence really is unavailable", async () => {
    const save = vi.fn().mockResolvedValue(null);
    expect(await resolveStudioDraftId(null, save)).toBeNull();
    expect(save).toHaveBeenCalledTimes(2);
  });
});
