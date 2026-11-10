import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dashboard = readFileSync(
  "src/pages/crm/CustomerDashboardPage.tsx",
  "utf8",
);
const profileHeader = readFileSync(
  "src/components/crm/customer-dashboard/CustomerProfileHeader.tsx",
  "utf8",
);
const contactCard = readFileSync(
  "src/components/crm/customer-dashboard/CustomerContactCard.tsx",
  "utf8",
);
const consentCard = readFileSync(
  "src/components/crm/customer-dashboard/CustomerConsentCard.tsx",
  "utf8",
);
const segmentsCard = readFileSync(
  "src/components/crm/customer-dashboard/CustomerSegmentsCard.tsx",
  "utf8",
);

describe("staff customer profile access", () => {
  it("derives editing and destructive capabilities from canonical access", () => {
    expect(dashboard).toContain(
      'const canEditCustomer = hasPermission("customers.write")',
    );
    expect(dashboard).toContain(
      'const canManageSegments = hasPermission("segments.manage")',
    );
    expect(dashboard).toContain(
      'const canDeleteCustomer = crmRole === "owner_admin"',
    );
  });

  it("passes read-only state to every mutating customer card", () => {
    expect(dashboard).toContain("canEdit={canEditCustomer}");
    expect(dashboard).toContain("canManage={canEditCustomer}");
    expect(dashboard).toContain("canManage={canManageSegments}");
    expect(dashboard).toContain("customerId && canEditCustomer");
  });

  it("hides edit, note, delete, consent, and assignment controls", () => {
    expect(profileHeader).toContain("{canEdit ? (");
    expect(profileHeader).toContain("{canDelete ? (");
    expect(contactCard).toContain("canEdit && onOpenBatchEdit");
    expect(consentCard).toContain("{canManage ? <JoyButton");
    expect(segmentsCard).toContain("canManage && !segmentPickerOpen");
    expect(segmentsCard).toContain("canManage && assignment.segment.type");
  });
});
