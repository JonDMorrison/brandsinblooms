import { describe, expect, it } from "vitest";

import {
  buildMailchimpCustomerSearchFilter,
  buildMailchimpSegmentArtifactLookup,
  getMailchimpConsentStatusLabel,
  mergeMatchedSuppressions,
  normalizeMailchimpEmail,
} from "@/hooks/useMailchimpImportedData";

describe("useMailchimpImportedData helpers", () => {
  it("builds a multi-token customer search filter for nested Mailchimp customer queries", () => {
    const filter = buildMailchimpCustomerSearchFilter(
      "Alice Miller",
      "crm_customers.",
    );

    expect(filter).toContain("crm_customers.email.ilike.%Alice Miller%");
    expect(filter).toContain(
      "and(crm_customers.first_name.ilike.%Alice%,crm_customers.last_name.ilike.%Miller%)",
    );
    expect(filter).toContain(
      "and(crm_customers.first_name.ilike.%Miller%,crm_customers.last_name.ilike.%Alice%)",
    );
  });

  it("maps Mailchimp consent statuses to user-facing labels", () => {
    expect(getMailchimpConsentStatusLabel("opted_in")).toBe("Subscribed");
    expect(getMailchimpConsentStatusLabel("opted_out")).toBe("Unsubscribed");
    expect(getMailchimpConsentStatusLabel("suppressed")).toBe("Suppressed");
    expect(getMailchimpConsentStatusLabel("unexpected")).toBe("Unknown");
  });

  it("normalizes and deduplicates matched suppressions by id", () => {
    const merged = mergeMatchedSuppressions(
      [
        {
          id: "suppression-1",
          customer_id: "customer-1",
          email: "Alice@Example.com ",
          phone: null,
          channel: "email",
          reason: "unsubscribed",
          suppressed_at: "2026-03-23T09:00:00.000Z",
          lifted_at: null,
          suppression_type: "unsubscribed",
          auto_suppressed: false,
          created_at: null,
          expires_at: null,
          source_event_id: null,
          tenant_id: "tenant-1",
          updated_at: null,
          lifted_by: null,
        },
      ],
      [
        {
          id: "suppression-1",
          customer_id: null,
          email: "alice@example.com",
          phone: null,
          channel: "email",
          reason: "unsubscribed",
          suppressed_at: "2026-03-23T09:00:00.000Z",
          lifted_at: null,
          suppression_type: "unsubscribed",
          auto_suppressed: false,
          created_at: null,
          expires_at: null,
          source_event_id: null,
          tenant_id: "tenant-1",
          updated_at: null,
          lifted_by: null,
        },
        {
          id: "suppression-2",
          customer_id: null,
          email: "bob@example.com",
          phone: null,
          channel: "email",
          reason: "complaint",
          suppressed_at: "2026-03-24T09:00:00.000Z",
          lifted_at: null,
          suppression_type: "complaint",
          auto_suppressed: false,
          created_at: null,
          expires_at: null,
          source_event_id: null,
          tenant_id: "tenant-1",
          updated_at: null,
          lifted_by: null,
        },
      ],
    );

    expect(merged).toHaveLength(2);
    expect(merged[0].id).toBe("suppression-2");
    expect(normalizeMailchimpEmail(merged[1].email)).toBe("alice@example.com");
  });

  it("builds Mailchimp segment artifact metadata from unique artifact names", () => {
    const lookup = buildMailchimpSegmentArtifactLookup([
      {
        artifact_type: "list",
        external_id: "list-1",
        name: "Newsletter",
        data: null,
      },
      {
        artifact_type: "segment",
        external_id: "list-1:segment-1",
        name: "VIP Customers",
        data: { parent_list_id: "list-1" },
      },
    ]);

    expect(lookup.get("VIP Customers")).toEqual({
      sourceId: "list-1:segment-1",
      parentListId: "list-1",
      parentListName: "Newsletter",
    });
  });

  it("drops ambiguous Mailchimp segment artifact matches", () => {
    const lookup = buildMailchimpSegmentArtifactLookup([
      {
        artifact_type: "list",
        external_id: "list-1",
        name: "Newsletter",
        data: null,
      },
      {
        artifact_type: "list",
        external_id: "list-2",
        name: "Events",
        data: null,
      },
      {
        artifact_type: "segment",
        external_id: "list-1:segment-1",
        name: "Repeat Buyers",
        data: { parent_list_id: "list-1" },
      },
      {
        artifact_type: "segment",
        external_id: "list-2:segment-9",
        name: "Repeat Buyers",
        data: { parent_list_id: "list-2" },
      },
    ]);

    expect(lookup.get("Repeat Buyers")).toEqual({
      sourceId: null,
      parentListId: null,
      parentListName: null,
    });
  });
});
