import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SavedTemplate } from "@/hooks/useSavedTemplates";

const navigate = vi.fn();
const hook = {
  savedTemplates: [] as SavedTemplate[],
  isLoading: false,
  error: null as Error | null,
  updateTemplateDetails: vi.fn().mockResolvedValue(undefined),
  duplicateTemplate: vi.fn().mockResolvedValue({ name: "Spring perennials (copy)" }),
  archiveTemplate: vi.fn().mockResolvedValue(undefined),
  isUpdatingDetails: false,
  isDuplicating: false,
  isArchiving: false,
};
let canWrite = true;

vi.mock("react-router-dom", async (original) => ({
  ...(await original<typeof import("react-router-dom")>()),
  useNavigate: () => navigate,
}));
vi.mock("@/hooks/useSavedTemplates", async (original) => ({
  ...(await original<typeof import("@/hooks/useSavedTemplates")>()),
  useSavedTemplates: () => hook,
}));
vi.mock("@/hooks/useUserRole", () => ({ useUserRole: () => ({ hasPermission: () => canWrite }) }));
vi.mock("@/components/crm/campaign-editor/IntentCardThumbnail", () => ({ IntentCardThumbnail: () => <div data-testid="thumbnail" /> }));
vi.mock("@/utils/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { CampaignTemplatesPage, newEmailFromTemplatePath } from "@/pages/crm/CampaignTemplatesPage";

const template = (id: string, fields: Partial<SavedTemplate> = {}): SavedTemplate => ({
  id,
  user_id: "u1",
  tenant_id: "t1",
  name: id,
  description: null,
  layout_json: [],
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  isOwn: true,
  category: null,
  tags: [],
  ...fields,
});
const show = () => render(<MemoryRouter><CampaignTemplatesPage /></MemoryRouter>);

beforeEach(() => {
  vi.clearAllMocks();
  canWrite = true;
  hook.error = null;
  hook.isLoading = false;
  hook.savedTemplates = [
    template("a", { name: "Spring perennials", category: "Spring", tags: ["sale"] }),
    template("b", { name: "Christmas trees", category: "Christmas", isOwn: false }),
  ];
});

describe("Template Library", () => {
  it("says a template is never sent and lists every saved design", () => {
    show();
    expect(screen.getByRole("heading", { name: "Templates" })).toBeVisible();
    expect(screen.getByText(/A template is never sent/)).toBeVisible();
    expect(screen.getByRole("article", { name: "Spring perennials" })).toBeVisible();
    expect(screen.getByRole("article", { name: "Christmas trees" })).toBeVisible();
    expect(screen.getByText("Showing 2 of 2 templates")).toBeVisible();
    // No send or schedule action exists on this page.
    expect(screen.queryByRole("button", { name: /send|schedule/i })).toBeNull();
  });

  it("searches as you type", async () => {
    const user = userEvent.setup();
    show();
    await user.type(screen.getByLabelText("Search"), "christmas");
    expect(screen.queryByRole("article", { name: "Spring perennials" })).toBeNull();
    expect(screen.getByText("Showing 1 of 2 templates")).toBeVisible();
  });

  it("uses a template for a new email without touching the template", async () => {
    const user = userEvent.setup();
    show();
    await user.click(within(screen.getByRole("article", { name: "Spring perennials" })).getByRole("button", { name: "Use for a new email" }));
    expect(navigate).toHaveBeenCalledWith(newEmailFromTemplatePath("a"));
    expect(hook.updateTemplateDetails).not.toHaveBeenCalled();
  });

  it("lets anyone copy a design, and only its owner change or delete it", () => {
    show();
    const mine = within(screen.getByRole("article", { name: "Spring perennials" }));
    const theirs = within(screen.getByRole("article", { name: "Christmas trees" }));
    expect(mine.getByRole("button", { name: "Delete Spring perennials" })).toBeVisible();
    expect(theirs.getByRole("button", { name: "Make a copy of Christmas trees" })).toBeVisible();
    expect(theirs.queryByRole("button", { name: /Delete/ })).toBeNull();
    expect(theirs.queryByRole("button", { name: /Edit details/ })).toBeNull();
    expect(theirs.getByText(/by a teammate/)).toBeVisible();
  });

  it("asks before deleting", async () => {
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole("button", { name: "Delete Spring perennials" }));
    expect(hook.archiveTemplate).not.toHaveBeenCalled();
    expect(screen.getByText(/cannot be undone/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Delete template" }));
    expect(hook.archiveTemplate).toHaveBeenCalledWith("a");
  });

  it("saves name, category and tags from the details dialog", async () => {
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole("button", { name: "Edit details of Spring perennials" }));
    const tags = screen.getByLabelText("Tags");
    await user.clear(tags);
    await user.type(tags, "sale, weekend");
    await user.click(screen.getByRole("button", { name: "Save details" }));
    expect(hook.updateTemplateDetails).toHaveBeenCalledWith(expect.objectContaining({ id: "a", name: "Spring perennials", category: "Spring", tags: ["sale", "weekend"] }));
  });

  it("is read-only without permission to write campaigns", () => {
    canWrite = false;
    show();
    expect(screen.queryByRole("button", { name: "Use for a new email" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Delete/ })).toBeNull();
  });

  it("explains how to make the first template", () => {
    hook.savedTemplates = [];
    show();
    expect(screen.getByText("No templates yet")).toBeVisible();
    expect(screen.getByText(/Save as template/)).toBeVisible();
  });
});
