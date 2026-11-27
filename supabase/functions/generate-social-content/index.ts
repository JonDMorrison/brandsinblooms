// Retired with social media management; logs the caller until deleted
// (docs/bloom-newsletter-audit.md, Retirement log).
import { retiredSocialFeatureResponse } from "../_shared/retiredSocialFeature.ts";
import { logRetiredFunctionCall } from "../_shared/retiredFunction.ts";

Deno.serve((request) => {
  logRetiredFunctionCall(request, "generate-social-content");
  return retiredSocialFeatureResponse(request);
});
