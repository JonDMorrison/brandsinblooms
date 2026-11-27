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
vi.mock("@/hooks/useTenant", () => ({ useTenant: () => ({ tenant: { id: "tenant-1" } }) }));
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

import { CampaignEditorProvider, useCampaignEditor } from "../CampaignEditorContext";

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
      <p data-testid="state">
        {editor.isSaving ? "saving" : editor.isDirty ? "dirty" : editor.lastSavedAt ? "saved" : "new"}
      </p>
      <button onClick={() => editor.updateSetup({ name: "Spring plans" })}>rename</button>
      <button onClick={() => editor.updateSetup({ name: "Typo" })}>typo</button>
      <button onClick={() => editor.revertName()}>revert</button>
      <button onClick={() => void editor.saveDraft({ silent: true })}>save</button>
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
    id: "campaign-1",
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
  designSystem.current = buildStudioDesignSystem({ name: "Fernhill Gardens" });
  api.persistCampaignDraft.mockImplementation((input: { name: string }) =>
    Promise.resolve({ id: "campaign-new", status: "draft", updatedAt: "2026-11-27T10:05:00Z", name: input.name }),
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
    expect(screen.getByTestId("path")).toHaveTextContent("/crm/campaigns/campaign-new");
    expect(screen.getByTestId("name")).toHaveTextContent("Spring plans");
    expect(screen.getByTestId("state")).toHaveTextContent("saved");
    expect(mounts).toBe(1);
    expect(api.fetchCampaignEditorRecord).not.toHaveBeenCalled();

    // Later saves update the same draft and keep the address.
    fireEvent.click(screen.getByText("typo"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100);
    });
    expect(api.persistCampaignDraft.mock.calls[1][0]).toMatchObject({ campaignId: "campaign-new", name: "Typo" });
    expect(screen.getByTestId("path")).toHaveTextContent("/crm/campaigns/campaign-new");
  });

  it("reopens the same draft from its address after a reload", async () => {
    api.fetchCampaignEditorRecord.mockResolvedValue(record({ id: "campaign-new", name: "Spring plans" }));
    renderAt("/crm/campaigns/campaign-new");
    await flush();
    await flush();
    expect(api.fetchCampaignEditorRecord).toHaveBeenCalledWith("campaign-new");
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
    renderAt("/crm/campaigns/campaign-1");
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
  it("shows saved as soon as the save responds, skipping unchanged audience links", async () => {
    api.fetchCampaignEditorRecord.mockResolvedValue(record());
    let respond: (value: unknown) => void = () => undefined;
    api.persistCampaignDraft.mockImplementation(
      () =>
        new Promise((resolve) => {
          respond = resolve;
        }),
    );
    renderAt("/crm/campaigns/campaign-1");
    await flush();
    await flush();
    fireEvent.click(screen.getByText("rename"));
    fireEvent.click(screen.getByText("save"));
    await flush();
    expect(screen.getByTestId("state")).toHaveTextContent("saving");
    expect(api.persistCampaignDraft.mock.calls[0][0]).toMatchObject({
      campaignId: "campaign-1",
      mirrorBlocksInBackground: true,
      syncAudienceLinks: false,
    });
    await act(async () => {
      respond({ id: "campaign-1", status: "draft", updatedAt: "2026-11-27T10:06:00Z" });
      await Promise.resolve();
    });
    expect(screen.getByTestId("state")).toHaveTextContent("saved");
    expect(screen.getByTestId("path")).toHaveTextContent("/crm/campaigns/campaign-1");
  });
});
