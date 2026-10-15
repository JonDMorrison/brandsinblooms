import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { IdealCustomerTypeExportPanel } from "./IdealCustomerTypeExportPanel";
const role = vi.hoisted(() => ({
  value: "owner_admin",
  tenant: "tenant-a",
  allowed: true,
}));
vi.mock("@/hooks/useUserRole", () => ({
  useUserRole: () => ({
    role: role.value,
    tenantId: role.tenant,
    hasPermission: () => role.allowed,
  }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => {
      throw new Error(
        "No database request should run when the review is closed",
      );
    }),
  },
}));
afterEach(cleanup);
beforeEach(() => {
  role.value = "owner_admin";
  role.tenant = "tenant-a";
  role.allowed = true;
});
describe("Ideal outbound review permissions and inactive view", () => {
  it("renders only for a current-company owner and does not load source data until opened", () => {
    render(<IdealCustomerTypeExportPanel tenantId="tenant-a" />);
    expect(screen.getByText("IdealPOS Customer Type bridge")).toBeVisible();
    expect(screen.getByText(/Review-only workflow/)).not.toBeVisible();
  });
  it.each(["staff", "store_manager"])(
    "does not show review controls to %s",
    (value) => {
      role.value = value;
      const view = render(<IdealCustomerTypeExportPanel tenantId="tenant-a" />);
      expect(view.container).toBeEmptyDOMElement();
    },
  );
  it("does not show another company’s controls", () => {
    role.tenant = "tenant-b";
    const view = render(<IdealCustomerTypeExportPanel tenantId="tenant-a" />);
    expect(view.container).toBeEmptyDOMElement();
  });
  it("requires actual loyalty-management permission", () => {
    role.allowed = false;
    const view = render(<IdealCustomerTypeExportPanel tenantId="tenant-a" />);
    expect(view.container).toBeEmptyDOMElement();
  });
});
