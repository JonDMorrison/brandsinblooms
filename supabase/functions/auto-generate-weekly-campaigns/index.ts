// Retired 2026-11-27: no live caller (docs/bloom-newsletter-audit.md, Retirement log).
// Answers 410 Gone and logs the caller until the function is deleted.
import { retiredFunctionResponse } from "../_shared/retiredFunction.ts";

Deno.serve((request) => retiredFunctionResponse(request, "auto-generate-weekly-campaigns"));
