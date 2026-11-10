import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  save: vi.fn(),
  navigate: vi.fn(),
  toast: vi.fn(),
}));
vi.mock("react-router-dom", () => ({ useNavigate: () => mocks.navigate }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: mocks.invoke } },
}));
vi.mock("@/utils/crmCampaignService", () => ({ saveCampaignAsDraft: mocks.save }));

import { useCampaignSending } from "@/hooks/useCampaignSending";

const input = {
  campaignId: "saved-campaign",
  campaignName: "Newsletter",
  subjectLine: "Latest news",
  preheaderText: "",
  senderName: "Garden Centre",
  senderEmail: "news@example.com",
  content: "",
  blocks: [{ id: "text", type: "text", content: "News" }],
  segments: [],
};

describe("sending a saved editor audience", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.save.mockResolvedValue({ id: "saved-campaign" });
    mocks.invoke.mockResolvedValue({ data: { total_recipients: 1805 }, error: null });
  });

  it("queues the canonical draft without overwriting All Contacts, personas, or direct recipients", async () => {
    const { result } = renderHook(() => useCampaignSending({ navigateOnSuccess: false, suppressToasts: true }));
    let response;
    await act(async () => {
      response = await result.current.sendCampaign({ ...input, draftAlreadySaved: true });
    });
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.invoke).toHaveBeenCalledWith("send-email-campaign", {
      body: expect.objectContaining({ campaignId: "saved-campaign" }),
    });
    expect(response).toMatchObject({ success: true, recipientCount: 1805 });
  });

  it("still saves for callers that have not persisted the draft", async () => {
    const { result } = renderHook(() => useCampaignSending({ navigateOnSuccess: false, suppressToasts: true }));
    await act(async () => { await result.current.sendCampaign(input); });
    expect(mocks.save).toHaveBeenCalledTimes(1);
    expect(mocks.invoke).toHaveBeenCalledTimes(1);
  });

  it("cannot skip creating a draft without a saved campaign ID", async () => {
    const { result } = renderHook(() => useCampaignSending({ navigateOnSuccess: false, suppressToasts: true }));
    await act(async () => {
      await result.current.sendCampaign({ ...input, campaignId: undefined, draftAlreadySaved: true });
    });
    expect(mocks.save).toHaveBeenCalledTimes(1);
  });
});
