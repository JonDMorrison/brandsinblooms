import "@testing-library/jest-dom/vitest";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/hooks/useEmailDomainManagement", () => ({
  useEmailDomainManagement: () => ({
    provisionDomain: vi.fn(),
    refetch: vi.fn(),
  }),
}));

vi.mock("@/hooks/useEntriConnect", () => ({
  useEntriConnect: () => ({
    openEntriSetup: vi.fn(),
    sanitizeAndConvertRecords: vi.fn(),
    isEntriConfigured: false,
    isLoading: false,
    scriptError: null,
    clearScriptError: vi.fn(),
  }),
}));

vi.mock("@/hooks/useTenant", () => ({
  useTenant: () => ({ tenant: { id: "tenant-1" } }),
}));

import { DomainConnectWizard } from "@/components/crm/settings/DomainConnectWizard";

describe("DomainConnectWizard z-index override (Bug 4)", () => {
  it("renders the Modal root with a computed z-index >= 1500 to clear Radix Dialog content (z-60)", () => {
    const { baseElement } = render(
      <DomainConnectWizard open onClose={vi.fn()} />,
    );

    const modalRoots = baseElement.querySelectorAll<HTMLElement>(
      '[role="presentation"]',
    );
    const found = Array.from(modalRoots).find((node) => {
      const computed = Number.parseInt(
        window.getComputedStyle(node).zIndex || "0",
        10,
      );
      return computed >= 1500;
    });

    expect(
      found,
      "expected at least one modal presentation root with computed zIndex >= 1500",
    ).toBeTruthy();
  });

  it("mounts without throwing when nested under a parent dialog node", () => {
    expect(() =>
      render(
        <div role="dialog" style={{ zIndex: 60 }}>
          <DomainConnectWizard open onClose={vi.fn()} />
        </div>,
      ),
    ).not.toThrow();
  });
});
