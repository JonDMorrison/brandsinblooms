import { describe, expect, it } from "vitest";
import { checkAttachments } from "./constants";

describe("support attachment filename length", () => {
  it("accepts 200 characters but rejects 201 with a clear warning", () => {
    const atLimit = new File(["png"], `${"a".repeat(196)}.png`, { type: "image/png" });
    const overLimit = new File(["png"], `${"a".repeat(197)}.png`, { type: "image/png" });

    expect(checkAttachments([atLimit])).toEqual({ accepted: [atLimit], rejected: [] });
    const result = checkAttachments([overLimit, atLimit]);
    expect(result.accepted).toEqual([atLimit]);
    expect(result.rejected).toEqual([
      `${overLimit.name}: filenames must be 200 characters or fewer`,
    ]);
    // The server measures the trimmed name, so surrounding spaces do not count.
    const padded = new File(["png"], ` ${atLimit.name} `, { type: "image/png" });
    expect(checkAttachments([padded])).toEqual({ accepted: [padded], rejected: [] });
  });
});
