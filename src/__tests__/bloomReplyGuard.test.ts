import { describe, expect, it } from "vitest";
import {
  correctFalseFailureReply,
  toolOutcomeFrom,
} from "../../supabase/functions/bloom-assist/reply-guard";

const tropicals = toolOutcomeFrom("completed", {
  success: true,
  message:
    "Search succeeded: 6,648 customers bought it. 14,971 have purchase records without it. 26,315 have no purchase records on file, so they are counted separately. This is a complete answer, not an error.",
  data: { trail: [{ label: "Top 50 Tropical Shoppers" }] },
});

describe("Bloom never reports a successful lookup as a failure", () => {
  it("replaces a false failure claim with what the search returned", () => {
    const reply = correctFalseFailureReply(
      "I attempted to retrieve the top 50 Tropical shoppers, but it seems there was an issue accessing the data. The result is currently unavailable.",
      [tropicals],
    );
    expect(reply).toBe(
      "Here is what I found.\n\nTop 50 Tropical Shoppers: 6,648 customers bought it. 14,971 have purchase records without it. 26,315 have no purchase records on file, so they are counted separately.",
    );
  });

  it("catches the other phrasings Bloom used", () => {
    for (const claim of [
      "It seems there was an issue retrieving the list of customers who purchased sea soil. The data could not be retrieved at this time.",
      "The purchase history could not be retrieved due to a timeout error.",
    ]) {
      expect(correctFalseFailureReply(claim, [tropicals])).toContain("6,648 customers bought it");
    }
  });

  it("leaves a correct answer alone", () => {
    const answer = "6,648 customers bought Tropicals. Jayne Ercog spent the most.";
    expect(correctFalseFailureReply(answer, [tropicals])).toBe(answer);
  });

  it("keeps the failure message when a lookup really failed", () => {
    const failed = toolOutcomeFrom("failed", { success: false, message: "The data lookup timed out before it finished." });
    const reply = "The purchase history could not be retrieved due to a timeout error.";
    expect(correctFalseFailureReply(reply, [tropicals, failed])).toBe(reply);
  });

  it("does nothing when no tool ran", () => {
    const reply = "I could not be retrieved anything without a question.";
    expect(correctFalseFailureReply(reply, [])).toBe(reply);
  });
});
