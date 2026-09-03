import { retiredSocialFeatureResponse } from "../_shared/retiredSocialFeature.ts";

Deno.serve((request) => retiredSocialFeatureResponse(request));
