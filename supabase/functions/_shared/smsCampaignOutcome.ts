export type SmsEnqueueOutcome = {
  success: boolean;
  code: string | null;
  enqueueStatus: "enqueuing" | "enqueued" | "failed";
  campaignStatus: "sending" | "failed" | null;
  totalEnqueued: number;
  message: string;
};

export function resolveSmsEnqueueOutcome(input: {
  existingTotal: number;
  messagesCreated: number;
  hasMoreCustomers: boolean;
}): SmsEnqueueOutcome {
  const existingTotal = Math.max(0, Number(input.existingTotal) || 0);
  const messagesCreated = Math.max(0, Number(input.messagesCreated) || 0);
  const totalEnqueued = existingTotal + messagesCreated;

  if (input.hasMoreCustomers) {
    return {
      success: true,
      code: null,
      enqueueStatus: "enqueuing",
      campaignStatus: null,
      totalEnqueued,
      message: `Campaign preparation in progress. ${messagesCreated} messages queued this run.`,
    };
  }

  if (totalEnqueued === 0) {
    return {
      success: false,
      code: "NO_ELIGIBLE_RECIPIENTS",
      enqueueStatus: "failed",
      campaignStatus: "failed",
      totalEnqueued,
      message: "Campaign failed because no recipients have current, documented SMS consent.",
    };
  }

  return {
    success: true,
    code: null,
    enqueueStatus: "enqueued",
    campaignStatus: "sending",
    totalEnqueued,
    message: `Campaign fully prepared. ${totalEnqueued} messages ready for sending.`,
  };
}
