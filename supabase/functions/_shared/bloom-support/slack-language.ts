/**
 * Bloom Support engineering explanations: deliberate plain language, not AI guesses.
 * This translation is cheap and deterministic. It never claims a client workflow works
 * just because GitHub or the hosting provider accepted the change.
 */
export type CustomerUpdate = { headline: string; whatItMeans: string; nextStep: string; requiresAttention: boolean };

const updates: Record<string, CustomerUpdate> = {
  "ticket.created": {
    headline: "New support request",
    whatItMeans: "A customer needs our help. The request is recorded.",
    nextStep: "Assign one person and decide the next action.", requiresAttention: true,
  },
  "ticket.reopened": {
    headline: "The customer says the problem is still happening",
    whatItMeans: "Our earlier answer or repair did not resolve their experience.",
    nextStep: "Recheck the original problem and respond on the existing ticket.", requiresAttention: true,
  },
  "ticket.needs_owner": {
    headline: "A team decision is needed",
    whatItMeans: "Bloom cannot safely make the next decision alone.",
    nextStep: "Jon or Jeff should open the ticket and choose the next action.", requiresAttention: true,
  },
  "ticket.unassigned": {
    headline: "A request needs an owner",
    whatItMeans: "Nobody has been assigned to follow through.",
    nextStep: "Assign someone to the ticket.", requiresAttention: true,
  },
  "ticket.stalled": {
    headline: "Progress has stopped",
    whatItMeans: "The request has not moved forward as expected.",
    nextStep: "Check the blocker and record a new next action.", requiresAttention: true,
  },
  "ticket.overdue": {
    headline: "A support deadline was missed",
    whatItMeans: "The customer may have waited longer than promised.",
    nextStep: "Review the ticket, assign help, and send an accurate update.", requiresAttention: true,
  },
  "engineering.awaiting_approval": {
    headline: "A repair is ready for review",
    whatItMeans: "Code was prepared. It has not been approved or proven live.",
    nextStep: "Have a qualified reviewer approve it; then release and verify.", requiresAttention: true,
  },
  "engineering.in_review": {
    headline: "A proposed repair is being checked",
    whatItMeans: "The team is reviewing code and tests. The customer fix is not confirmed.",
    nextStep: "Finish review, then deploy and test the affected customer workflow.", requiresAttention: false,
  },
  "engineering.escalated": {
    headline: "A repair needs human help",
    whatItMeans: "Bloom reached a decision or technical problem it cannot resolve safely alone.",
    nextStep: "Review the reason and choose how to unblock it.", requiresAttention: true,
  },
  "engineering.failed": {
    headline: "The attempted repair did not succeed",
    whatItMeans: "The automated repair process encountered a problem.",
    nextStep: "Investigate the failure. Do not tell the customer it is fixed.", requiresAttention: true,
  },
  "engineering.deployed": {
    headline: "A repair reached production",
    whatItMeans: "New code was deployed. The customer's original task is not yet confirmed working.",
    nextStep: "Test the exact customer problem using their real environment.", requiresAttention: false,
  },
  "engineering.verified": {
    headline: "A repair passed its customer test",
    whatItMeans: "The affected workflow was verified in production, based on recorded evidence.",
    nextStep: "Close the loop with the customer and retain a regression test.", requiresAttention: false,
  },
  "feature.awaiting_decision": {
    headline: "A product idea needs a decision",
    whatItMeans: "A feature request has been recorded, but has not been approved.",
    nextStep: "Decide whether it fits the product and link the customer request.", requiresAttention: true,
  },
  "escalation.overdue": {
    headline: "An escalation needs attention",
    whatItMeans: "An important issue is waiting too long for a person.",
    nextStep: "Take ownership and tell the customer what happens next.", requiresAttention: true,
  },
  "job.dead": {
    headline: "Bloom could not complete an automated task",
    whatItMeans: "Automatic retries have stopped to avoid repeated failures or cost.",
    nextStep: "Check the error and handle the request manually if needed.", requiresAttention: true,
  },
};

export function explainSupportEvent(kind: string): CustomerUpdate {
  const known = updates[kind];
  if (known) return known;
  if (kind.startsWith("alert.")) return {
    headline: "A system needs attention", whatItMeans: "An automated reliability check reported a problem.",
    nextStep: "Check the incident record and determine customer impact.", requiresAttention: true,
  };
  if (kind.startsWith("engineering.")) return {
    headline: "A repair changed status", whatItMeans: "Engineering made progress. This alone does not mean a customer fix is live.",
    nextStep: "Open the linked issue and check deployment and customer verification.", requiresAttention: false,
  };
  if (kind.startsWith("feature.")) return {
    headline: "A feature request changed status", whatItMeans: "The product team has an update on a requested improvement.",
    nextStep: "Read the feature record and update the requester when appropriate.", requiresAttention: false,
  };
  return {
    headline: "A support request changed", whatItMeans: "Bloom recorded an update.",
    nextStep: "Open Bloom Support for the latest verified status.", requiresAttention: false,
  };
}

export type GithubMilestone = "pr_merged" | "pr_closed" | "checks_failed" | "checks_passed" | "deployment_succeeded" | "deployment_failed";
const githubUpdates: Record<GithubMilestone, CustomerUpdate> = {
  pr_merged: {
    headline: "A code change was merged",
    whatItMeans: "The team accepted the change into the codebase. This does not prove it is deployed or that the customer can use it.",
    nextStep: "Check production deployment, then test the customer's original task.", requiresAttention: false,
  },
  pr_closed: {
    headline: "A proposed code change was closed",
    whatItMeans: "This proposal was not merged. No release is implied.",
    nextStep: "Check whether the work was replaced or is no longer needed.", requiresAttention: false,
  },
  checks_failed: {
    headline: "An automated code check failed",
    whatItMeans: "Something needs investigation before the change can be trusted.",
    nextStep: "Review the failure and fix it before release.", requiresAttention: true,
  },
  checks_passed: {
    headline: "Automated code checks passed",
    whatItMeans: "Tests completed successfully. The change may still require approval, release and customer verification.",
    nextStep: "Check approval and release requirements.", requiresAttention: false,
  },
  deployment_succeeded: {
    headline: "A production deployment was reported successful",
    whatItMeans: "The hosting system accepted the release. The customer experience has not been verified by this event.",
    nextStep: "Re-test the original customer workflow.", requiresAttention: false,
  },
  deployment_failed: {
    headline: "A production deployment failed",
    whatItMeans: "The release did not finish successfully, so the intended improvement is not confirmed live.",
    nextStep: "Investigate the deployment and protect the existing working version.", requiresAttention: true,
  },
};
export function explainGithubMilestone(milestone: GithubMilestone): CustomerUpdate {
  return githubUpdates[milestone];
}
export function githubMilestoneFromKind(kind: string): GithubMilestone | null {
  if (!kind.startsWith("github.")) return null;
  const value = kind.slice(7);
  return Object.prototype.hasOwnProperty.call(githubUpdates, value) ? value as GithubMilestone : null;
}
