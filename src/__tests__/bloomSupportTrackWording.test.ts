import { describe, expect, it } from "vitest";
import { clientSystemText } from "@/lib/bloomSupport/clientWording";
import { sanitizeTrackView, type TrackView } from "@/lib/bloomSupport/trackView";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const at = (minute: number) => new Date(Date.UTC(2026, 10, 5, 17, minute)).toISOString();
const message = (n: number, over: Record<string, unknown>) => ({
  id: id(n), author: "team", name: "Bloom Support", automatic: false, purpose: "reply", body: `message ${n}`, created_at: at(n), attachments: [], ...over,
});
const view = (messages: unknown[]): TrackView => {
  const v = sanitizeTrackView({ state: "ok", number: 1015, subject: "Import history", product: "crm", kind: "idea", status: "in_progress", step: 2, created_at: at(0), messages });
  if (!v || v.state !== "ok") throw new Error("expected a ticket view");
  return v;
};

describe("client projection: Bloom's automatic copy never names staff", () => {
  it("rewords old stored automatic messages that named Jon or Jeff", () => {
    const v = view([
      message(1, { automatic: true, purpose: "progress", body: "Thanks for the suggestion. We've passed it to Jon for a decision and will let you know the outcome." }),
      message(2, { automatic: true, purpose: "progress", body: "Jon/Jeff will review this today. Jeff's update is below." }),
      message(3, { author: "system", automatic: true, purpose: "notification", body: "Jeff/Support: preparing the change. Passed to Jon Morrison." }),
    ]);
    expect(v.messages.map((m) => m.body)).toEqual([
      "Thanks for the suggestion. We've passed it to our team for a decision and will let you know the outcome.",
      "Our team will review this today. Our team's update is below.",
      "Our support team: preparing the change. Passed to our team.",
    ]);
    expect(JSON.stringify(v)).not.toMatch(/\b(Jon|Jeff)\b/);
  });

  it("never touches what a person wrote: staff replies and the client's own words stay as written", () => {
    const v = view([
      message(1, { author: "customer", name: "Jon", purpose: null, body: "Hi, it's Jon. Please ask Jeff to call me." }),
      message(2, { automatic: false, purpose: "reply", body: "Hi Jon, Jeff here — I'll call you at 3." }),
    ]);
    expect(v.messages.map((m) => m.body)).toEqual([
      "Hi, it's Jon. Please ask Jeff to call me.",
      "Hi Jon, Jeff here — I'll call you at 3.",
    ]);
  });

  it("leaves text without a staff name unchanged, including words that merely contain the letters", () => {
    for (const text of ["We've passed it to our team for a decision.", "Jonquil and Jefferson planters are back in stock.", ""]) {
      expect(clientSystemText(text)).toBe(text);
    }
  });

  it("capitalises only at the start of a sentence or line", () => {
    expect(clientSystemText("Jon decides.\nJeff reviews. Ask Jon or Jeff.")).toBe("Our team decides.\nOur team reviews. Ask our team.");
  });
});
