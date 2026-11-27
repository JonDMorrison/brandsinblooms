import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation, useParams } from "react-router-dom";
import { buildStudioDesignSystem } from "@/lib/studio/designSystem";
import type { CampaignEditorRecord } from "@/lib/crm/campaignEditor";
import { ensureFooterBlockCompliance } from "@/lib/studio/footerCompliance";

// Saves are mocked: nothing reaches the database and nothing is sent.
const api = vi.hoisted(() => ({
  fetchCampaignEditorRecord: vi.fn(),
  persistCampaignDraft: vi.fn(),
  updateCampaignStatus: vi.fn(),
}));
vi.mock("@/lib/crm/campaignEditor", () => api);
vi.mock("@/lib/computeAudienceRecipientCount", () => ({
  computeAudienceRecipientCount: () => Promise.resolve(0),
}));
vi.mock("@/hooks/useCampaignSending", () => ({
  useCampaignSending: () => ({ sendCampaign: vi.fn() }),
}));
const designSystem = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/contexts/DesignSystemContext", () => ({
  useDesignSystem: () => ({ designSystem: designSystem.current, isLoading: false }),
}));
const tenantState = vi.hoisted(() => ({
  current: { tenant: { id: "tenant-1" } as { id: string } | null, loading: false },
}));
vi.mock("@/hooks/useTenant", () => ({ useTenant: () => tenantState.current }));
vi.mock("@/hooks/useSenderConfiguration", () => ({
  useSenderConfiguration: () => ({
    senderConfig: {
      displayName: "Fernhill Gardens",
      senderEmail: "news@fernhill.com",
      replyToEmail: "news@fernhill.com",
      fromEmailDomainId: "domain-1",
      isVerified: true,
    },
  }),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { AUTO_SAVE_MS, CampaignEditorProvider, useCampaignEditor } from "../CampaignEditorContext";
import { CampaignNotFoundError } from "@/lib/crm/campaignLookup";
import { supabase } from "@/integrations/supabase/client";

const CAMPAIGN_ID = "6f1c2a8e-4b7d-4e2a-9c31-0a5e7d9b1f42";
const NEW_ID = "b3d9e0f1-2c4a-4f6b-8e7d-1a2b3c4d5e6f";

let mounts = 0;
function Probe() {
  const editor = useCampaignEditor();
  const location = useLocation();
  React.useEffect(() => {
    mounts += 1;
  }, []);
  return (
    <div>
      <p data-testid="path">{location.pathname}</p>
      <p data-testid="name">{editor.name}</p>
      <p data-testid="subject">{editor.subjectLine}</p>
      <p data-testid="load">{editor.loadState}</p>
      <p data-testid="state">
        {editor.isSaving ? "saving" : editor.isDirty ? "dirty" : editor.lastSavedAt ? "saved" : "new"}
      </p>
      <button onClick={() => editor.updateSetup({ name: "Spring plans" })}>rename</button>
      <button onClick={() => editor.updateSetup({ name: "Typo" })}>typo</button>
      <button onClick={() => editor.revertName()}>revert</button>
      <button onClick={() => void editor.saveDraft({ silent: true })}>save</button>
      <button onClick={() => editor.updateAudience({ includeAllCustomers: true })}>audience</button>
    </div>
  );
}
function Page() {
  const { campaignId } = useParams<{ campaignId: string }>();
  return (
    <CampaignEditorProvider campaignId={campaignId}>
      <Probe />
    </CampaignEditorProvider>
  );
}
function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/crm/campaigns/new" element={<Page />} />
        <Route path="/crm/campaigns/:campaignId" element={<Page />} />
      </Routes>
    </MemoryRouter>,
  );
}

function record(patch: Partial<CampaignEditorRecord> = {}): CampaignEditorRecord {
  return {
    id: CAMPAIGN_ID,
    name: "Saved name",
    status: "draft",
    channel: "email",
    subjectLine: "Winter wreaths",
    preheaderText: "",
    senderName: "Fernhill Gardens",
    senderEmail: "news@fernhill.com",
    replyTo: "news@fernhill.com",
    contentBlocks: [],
    smsMessage: "",
    scheduledAt: null,
    segments: [],
    personas: [],
    includeAllCustomers: false,
    additionalCustomerIds: [],
    sourceContentTaskId: null,
    sendBlockedReason: null,
    updatedAt: "2026-11-27T10:00:00Z",
    ...patch,
  } as CampaignEditorRecord;
}

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

beforeEach(() => {
  vi.useFakeTimers();
  mounts = 0;
  tenantState.current = { tenant: { id: "tenant-1" }, loading: false };
  designSystem.current = buildStudioDesignSystem({ name: "Fernhill Gardens" });
  api.persistCampaignDraft.mockImplementation((input: { name: string }) =>
    Promise.resolve({ id: NEW_ID, status: "draft", updatedAt: "2026-11-27T10:05:00Z", name: input.name }),
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("campaign editor first save", () => {
  it("moves /crm/campaigns/new to the draft's address without remounting or refetching", async () => {
    renderAt("/crm/campaigns/new");
    await flush();
    fireEvent.click(screen.getByText("rename"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100);
    });
    expect(api.persistCampaignDraft).toHaveBeenCalledTimes(1);
    expect(api.persistCampaignDraft.mock.calls[0][0]).toMatchObject({ campaignId: null, name: "Spring plans" });
    expect(screen.getByTestId("path")).toHaveTextContent(`/crm/campaigns/${NEW_ID}`);
    expect(screen.getByTestId("name")).toHaveTextContent("Spring plans");
    expect(screen.getByTestId("state")).toHaveTextContent("saved");
    expect(mounts).toBe(1);
    expect(api.fetchCampaignEditorRecord).not.toHaveBeenCalled();

    // Later saves update the same draft and keep the address.
    fireEvent.click(screen.getByText("typo"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100);
    });
    expect(api.persistCampaignDraft.mock.calls[1][0]).toMatchObject({ campaignId: NEW_ID, name: "Typo" });
    expect(screen.getByTestId("path")).toHaveTextContent(`/crm/campaigns/${NEW_ID}`);
  });

  it("reopens the same draft from its address after a reload", async () => {
    api.fetchCampaignEditorRecord.mockResolvedValue(record({ id: NEW_ID, name: "Spring plans" }));
    renderAt(`/crm/campaigns/${NEW_ID}`);
    await flush();
    await flush();
    expect(api.fetchCampaignEditorRecord).toHaveBeenCalledWith(NEW_ID, { tenantId: "tenant-1" });
    expect(screen.getByTestId("name")).toHaveTextContent("Spring plans");
  });
});

describe("campaign name Escape", () => {
  it("puts back the last saved name and saves nothing", async () => {
    // A saved draft that already carries its compliance footer opens clean.
    api.fetchCampaignEditorRecord.mockResolvedValue(
      record({
        contentBlocks: ensureFooterBlockCompliance([], {
          designSystem: designSystem.current as ReturnType<typeof buildStudioDesignSystem>,
        }),
      }),
    );
    renderAt(`/crm/campaigns/${CAMPAIGN_ID}`);
    await flush();
    await flush();
    expect(screen.getByTestId("name")).toHaveTextContent("Saved name");
    expect(screen.getByTestId("state")).toHaveTextContent("saved");
    fireEvent.click(screen.getByText("typo"));
    expect(screen.getByTestId("state")).toHaveTextContent("dirty");
    fireEvent.click(screen.getByText("revert"));
    expect(screen.getByTestId("name")).toHaveTextContent("Saved name");
    expect(screen.getByTestId("state")).toHaveTextContent("saved");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    expect(api.persistCampaignDraft).not.toHaveBeenCalled();
  });
});

describe("save status", () => {
  it("autosave reaches saved within 2 seconds of the last keystroke", async () => {
    api.fetchCampaignEditorRecord.mockResolvedValue(record());
    renderAt(`/crm/campaigns/${CAMPAIGN_ID}`);
    await flush();
    await flush();
    fireEvent.click(screen.getByText("rename"));
    expect(screen.getByTestId("state")).toHaveTextContent("dirty");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1900);
    });
    expect(api.persistCampaignDraft).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("state")).toHaveTextContent("saved");
  });

  it("waits for typing to pause before saving", async () => {
    api.fetchCampaignEditorRecord.mockResolvedValue(record());
    renderAt(`/crm/campaigns/${CAMPAIGN_ID}`);
    await flush();
    await flush();
    fireEvent.click(screen.getByText("rename"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTO_SAVE_MS - 100);
    });
    fireEvent.click(screen.getByText("typo"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTO_SAVE_MS - 100);
    });
    expect(api.persistCampaignDraft).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(api.persistCampaignDraft).toHaveBeenCalledTimes(1);
    expect(api.persistCampaignDraft.mock.calls[0][0]).toMatchObject({ name: "Typo" });
  });

  it("shows saved as soon as the save responds, skipping unchanged audience links", async () => {
    api.fetchCampaignEditorRecord.mockResolvedValue(record());
    let respond: (value: unknown) => void = () => undefined;
    api.persistCampaignDraft.mockImplementation(
      () =>
        new Promise((resolve) => {
          respond = resolve;
        }),
    );
    renderAt(`/crm/campaigns/${CAMPAIGN_ID}`);
    await flush();
    await flush();
    fireEvent.click(screen.getByText("rename"));
    fireEvent.click(screen.getByText("save"));
    await flush();
    expect(screen.getByTestId("state")).toHaveTextContent("saving");
    expect(api.persistCampaignDraft.mock.calls[0][0]).toMatchObject({
      campaignId: CAMPAIGN_ID,
      mirrorBlocksInBackground: true,
      syncAudienceLinks: false,
    });
    await act(async () => {
      respond({ id: CAMPAIGN_ID, status: "draft", updatedAt: "2026-11-27T10:06:00Z" });
      await Promise.resolve();
    });
    expect(screen.getByTestId("state")).toHaveTextContent("saved");
    expect(screen.getByTestId("path")).toHaveTextContent(`/crm/campaigns/${CAMPAIGN_ID}`);
  });
});

// A page load never creates a campaign: only an explicit action does.
describe("an address that names no campaign in this business", () => {
  async function editEverything() {
    fireEvent.click(screen.getByText("rename"));
    fireEvent.click(screen.getByText("audience"));
    fireEvent.click(screen.getByText("save"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });
  }

  it("loads a campaign of this business by its id", async () => {
    api.fetchCampaignEditorRecord.mockResolvedValue(record({ name: "Spring plans" }));
    renderAt(`/crm/campaigns/${CAMPAIGN_ID}`);
    await flush();
    await flush();
    expect(api.fetchCampaignEditorRecord).toHaveBeenCalledWith(CAMPAIGN_ID, { tenantId: "tenant-1" });
    expect(screen.getByTestId("load")).toHaveTextContent("loaded");
    expect(screen.getByTestId("name")).toHaveTextContent("Spring plans");
  });

  it("an unknown id shows not found and inserts nothing", async () => {
    api.fetchCampaignEditorRecord.mockRejectedValue(new CampaignNotFoundError(CAMPAIGN_ID));
    renderAt(`/crm/campaigns/${CAMPAIGN_ID}`);
    await flush();
    await flush();
    expect(screen.getByTestId("load")).toHaveTextContent("not-found");
    // The load alone (the verified-sender backfill included) saves nothing.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });
    expect(api.persistCampaignDraft).not.toHaveBeenCalled();
    await editEverything();
    expect(api.persistCampaignDraft).not.toHaveBeenCalled();
    expect(screen.getByTestId("path")).toHaveTextContent(`/crm/campaigns/${CAMPAIGN_ID}`);
  });

  it("a malformed id shows not found without any request", async () => {
    renderAt("/crm/campaigns/not-a-campaign");
    await flush();
    expect(screen.getByTestId("load")).toHaveTextContent("not-found");
    await editEverything();
    expect(api.fetchCampaignEditorRecord).not.toHaveBeenCalled();
    expect(api.persistCampaignDraft).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalledWith("crm_campaigns");
  });

  it("another business's id shows not found, shows none of it and inserts nothing", async () => {
    // The lookup is scoped to the current business, so the other business's
    // row is never returned.
    api.fetchCampaignEditorRecord.mockImplementation(
      (id: string, options: { tenantId?: string | null }) =>
        options?.tenantId === "tenant-other"
          ? Promise.resolve(record({ id, name: "Other business plans", subjectLine: "Their sale" }))
          : Promise.reject(new CampaignNotFoundError(id)),
    );
    renderAt(`/crm/campaigns/${CAMPAIGN_ID}`);
    expect(screen.getByTestId("name")).toHaveTextContent("");
    await flush();
    await flush();
    expect(api.fetchCampaignEditorRecord).toHaveBeenCalledWith(CAMPAIGN_ID, { tenantId: "tenant-1" });
    expect(screen.getByTestId("load")).toHaveTextContent("not-found");
    expect(screen.getByTestId("name")).toHaveTextContent("");
    expect(screen.getByTestId("subject")).toHaveTextContent("");
    await editEverything();
    expect(api.persistCampaignDraft).not.toHaveBeenCalled();
  });

  it("waits for a master admin's business before looking the campaign up", async () => {
    tenantState.current = { tenant: null, loading: true };
    api.fetchCampaignEditorRecord.mockResolvedValue(record());
    const view = renderAt(`/crm/campaigns/${CAMPAIGN_ID}`);
    await flush();
    expect(api.fetchCampaignEditorRecord).not.toHaveBeenCalled();
    expect(screen.getByTestId("load")).toHaveTextContent("loading");
    tenantState.current = { tenant: { id: "tenant-active" }, loading: false };
    view.rerender(
      <MemoryRouter initialEntries={[`/crm/campaigns/${CAMPAIGN_ID}`]}>
        <Routes>
          <Route path="/crm/campaigns/:campaignId" element={<Page />} />
        </Routes>
      </MemoryRouter>,
    );
    await flush();
    await flush();
    expect(api.fetchCampaignEditorRecord).toHaveBeenCalledWith(CAMPAIGN_ID, { tenantId: "tenant-active" });
    expect(screen.getByTestId("load")).toHaveTextContent("loaded");
  });

  it("switching business hides the campaign when the new business has no such id", async () => {
    api.fetchCampaignEditorRecord.mockImplementation(
      (id: string, options: { tenantId?: string | null }) =>
        options?.tenantId === "tenant-1"
          ? Promise.resolve(record({ id, name: "Spring plans" }))
          : Promise.reject(new CampaignNotFoundError(id)),
    );
    const view = renderAt(`/crm/campaigns/${CAMPAIGN_ID}`);
    await flush();
    await flush();
    expect(screen.getByTestId("name")).toHaveTextContent("Spring plans");
    tenantState.current = { tenant: { id: "tenant-2" }, loading: false };
    view.rerender(
      <MemoryRouter initialEntries={[`/crm/campaigns/${CAMPAIGN_ID}`]}>
        <Routes>
          <Route path="/crm/campaigns/:campaignId" element={<Page />} />
        </Routes>
      </MemoryRouter>,
    );
    await flush();
    await flush();
    expect(screen.getByTestId("load")).toHaveTextContent("not-found");
    expect(screen.getByTestId("name")).toHaveTextContent("");
    await editEverything();
    expect(api.persistCampaignDraft).not.toHaveBeenCalled();
  });

  it("a failed read saves nothing either", async () => {
    api.fetchCampaignEditorRecord.mockRejectedValue(new Error("Network down"));
    renderAt(`/crm/campaigns/${CAMPAIGN_ID}`);
    await flush();
    await flush();
    expect(screen.getByTestId("load")).toHaveTextContent("error");
    await editEverything();
    expect(api.persistCampaignDraft).not.toHaveBeenCalled();
  });
});
