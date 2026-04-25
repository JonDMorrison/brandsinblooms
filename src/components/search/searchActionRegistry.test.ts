import {
  getCommandIdFromSearchItem,
  getCommandSearchItems,
  getResolvedCommandAction,
  getResultActionItems,
  getRouteAwareSuggestionItems,
  isCommandModeQuery,
} from "./searchActionRegistry";
import type { SearchResultItem } from "./types";

describe("searchActionRegistry", () => {
  it("switches into command mode when the query starts with >", () => {
    expect(isCommandModeQuery("> create campaign")).toBe(true);
    expect(isCommandModeQuery("create campaign")).toBe(false);
  });

  it("finds command registry results for command-mode queries", () => {
    const results = getCommandSearchItems("> create campaign", "/crm/campaigns");

    expect(results[0]).toMatchObject({
      id: "command:create-campaign",
      title: "Create Campaign",
      route: "/crm/campaigns/new",
    });
    expect(getCommandIdFromSearchItem(results[0])).toBe("create-campaign");
  });

  it("returns route-aware suggestions for campaign detail pages", () => {
    const results = getRouteAwareSuggestionItems("/crm/campaigns/camp_123");

    expect(results.map((item) => item.id)).toEqual([
      "command:preview-campaign",
      "command:view-campaign-recipients",
      "command:send-test-email",
    ]);

    const sendTestEmail = getResolvedCommandAction(
      "send-test-email",
      "/crm/campaigns/camp_123",
    );

    expect(sendTestEmail).toMatchObject({
      execution: {
        type: "send-test-email",
        campaignRoute: "/crm/campaigns/camp_123",
      },
    });
  });

  it("builds customer submenu actions with a copy-email action", () => {
    const customer: SearchResultItem = {
      id: "db:customer:cust_123",
      type: "customer",
      title: "Avery Bloom",
      subtitle: "avery@example.com • 555-0100",
      route: "/crm/customers/cust_123",
      categoryIcon: "customers",
      group: "customers",
    };

    const actions = getResultActionItems(customer);

    expect(actions.map((action) => action.label)).toEqual([
      "View Dashboard",
      "Create Campaign for Customer",
      "Send SMS",
      "Copy Email",
    ]);
    expect(actions[3]).toMatchObject({
      execution: {
        type: "copy",
        value: "avery@example.com",
      },
      keepPaletteOpen: true,
      successLabel: "Copied!",
    });
  });

  it("builds automation actions with an inline activate/deactivate operation", () => {
    const automation: SearchResultItem = {
      id: "db:automation:auto_123",
      type: "automation",
      title: "Welcome Flow",
      route: "/crm/automations/auto_123",
      metadata: "Inactive",
      categoryIcon: "automations",
      group: "automations",
    };

    const actions = getResultActionItems(automation);

    expect(actions.map((action) => action.label)).toEqual([
      "Edit Workflow",
      "Activate",
    ]);
    expect(actions[1]).toMatchObject({
      execution: {
        type: "toggle-automation",
        automationId: "auto_123",
        nextIsActive: true,
      },
      keepPaletteOpen: true,
    });
  });

  it("builds form actions from the visible embed key", () => {
    const form: SearchResultItem = {
      id: "db:form:form_123",
      type: "form",
      title: "Wedding Inquiry",
      subtitle: "Embed key embed_123",
      route: "/crm/forms/form_123",
      categoryIcon: "forms",
      group: "forms",
    };

    const actions = getResultActionItems(form);

    expect(actions.map((action) => action.label)).toEqual([
      "Open Editor",
      "Preview Form",
      "View Submissions",
      "Copy Embed Code",
    ]);
    expect(actions[1]).toMatchObject({
      execution: {
        type: "open-new-tab",
        route: "/f/embed_123",
      },
    });
    expect(actions[3]).toMatchObject({
      execution: {
        type: "copy",
      },
      keepPaletteOpen: true,
      successLabel: "Copied!",
    });
    expect(actions[3].execution.type).toBe("copy");
    if (actions[3].execution.type === "copy") {
      expect(actions[3].execution.value).toContain("data-bloomsuite-form=\"embed_123\"");
    }
  });
});