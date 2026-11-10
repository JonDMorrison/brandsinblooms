import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync("src/pages/sms/SMSCampaignDetail.tsx", "utf8");
const migration = readFileSync(
  "supabase/migrations/20260903125655_accurate_sms_campaign_outcomes.sql",
  "utf8",
);

describe("SMS campaign reporting release gate", () => {
  it("shows delivery, unique clicks, total clicks, rate, and SMS opt-outs explicitly", () => {
    expect(page).toContain('label="Delivered"');
    expect(page).toContain('label="Unique clicks"');
    expect(page).toContain('label="Total clicks"');
    expect(page).toContain('label="Click-through rate"');
    expect(page).toContain('label="SMS opt-outs"');
    expect(page).toContain("unique_links_clicked");
    expect(page).toContain("links_clicked");
  });

  it("attributes only exact, opted-in STOP transitions to the originating campaign", () => {
    expect(migration).toContain("NEW.keyword <> 'stop'");
    expect(migration).toContain("message.id::text = NEW.external_id");
    expect(migration).toContain("message.customer_id = NEW.customer_id");
    expect(migration).toContain("FOR UPDATE");
    expect(migration).toContain("'opt_outs'");
  });

  it("keeps the trigger function locked down with a fixed search path", () => {
    expect(migration).toContain("SECURITY DEFINER");
    expect(migration).toContain("SET search_path = ''");
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.attribute_sms_opt_out_to_campaign\(\)[\s\S]*anon, authenticated/);
  });
});
