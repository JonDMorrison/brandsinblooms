import { describe, expect, it } from "vitest";
import {
  buildTaskPlanFromDetectedTextPlan,
  MISSING_SEND_MODE_MESSAGE,
} from "@/hooks/askBloom/useAskBloomStreaming";

const CAMPAIGN_ID = "55555555-5555-4555-8555-555555555555";

const planFor = (params: Record<string, string>) =>
  buildTaskPlanFromDetectedTextPlan(
    {
      title: "Send the spring newsletter",
      resourceType: "campaign",
      steps: [{ action: "Send campaign", params }],
    },
    "assistant-message-1",
  );

describe("Ask Bloom text-plan send_mode", () => {
  it("never defaults a missing send_mode to now; the task is blocked with a question", () => {
    const [task] = planFor({ "Campaign ID": CAMPAIGN_ID }).tasks;

    expect(task.toolName).toBe("send_campaign");
    expect(task.toolParams).not.toHaveProperty("send_mode");
    expect(task.toolParams).not.toHaveProperty("scheduled_at");
    expect(task.validationAnnotations).toEqual([
      { type: "error", message: MISSING_SEND_MODE_MESSAGE, step: "send_mode" },
    ]);
  });

  it("keeps an explicit send_mode and does not block the task", () => {
    const [task] = planFor({
      "Campaign ID": CAMPAIGN_ID,
      "Send Mode": "now",
    }).tasks;

    expect(task.toolParams.send_mode).toBe("now");
    expect(task.validationAnnotations).toEqual([]);
  });
});
