import { describe, expect, it } from "vitest";

import {
  MAILCHIMP_ACTIVE_IMPORT_MAX_AGE_MS,
  MAILCHIMP_IMPORT_STALE_THRESHOLD_MS,
  isMailchimpImportJobActivelyRunning,
  isMailchimpImportJobStale,
} from "@/hooks/mailchimpImportState";

describe("mailchimpImportState", () => {
  it("treats recent running imports as active", () => {
    const now = Date.now();
    const job = {
      status: "running",
      created_at: new Date(now - 5 * 60_000).toISOString(),
      updated_at: new Date(now - 15_000).toISOString(),
    };

    expect(isMailchimpImportJobActivelyRunning(job, now)).toBe(true);
    expect(isMailchimpImportJobStale(job, now)).toBe(false);
  });

  it("marks recent heartbeat gaps as stale while the import is still active", () => {
    const now = Date.now();
    const job = {
      status: "pending",
      created_at: new Date(now - 10 * 60_000).toISOString(),
      updated_at: new Date(now - MAILCHIMP_IMPORT_STALE_THRESHOLD_MS - 5_000).toISOString(),
    };

    expect(isMailchimpImportJobActivelyRunning(job, now)).toBe(true);
    expect(isMailchimpImportJobStale(job, now)).toBe(true);
  });

  it("hides abandoned running imports that have been idle too long", () => {
    const now = Date.now();
    const job = {
      status: "running",
      created_at: new Date(now - MAILCHIMP_ACTIVE_IMPORT_MAX_AGE_MS - 60_000).toISOString(),
      updated_at: new Date(now - MAILCHIMP_ACTIVE_IMPORT_MAX_AGE_MS - 1_000).toISOString(),
    };

    expect(isMailchimpImportJobActivelyRunning(job, now)).toBe(false);
    expect(isMailchimpImportJobStale(job, now)).toBe(false);
  });
});