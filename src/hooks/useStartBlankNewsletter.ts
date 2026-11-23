import * as React from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/utils/toast";
import { useTenant } from "@/hooks/useTenant";
import { persistCampaignDraft } from "@/lib/crm/campaignEditor";
import { createStudioBlock } from "@/lib/studio/blockFactory";
import type { StudioBlock } from "@/types/studioBlocks";

/**
 * "Open blank editor": create a draft with a blank canvas (a header and an
 * empty paragraph; the footer is added on save) and open it straight in
 * Design Studio. No setup form or layout picker on this path. Pass `blocks`
 * to start from a saved template instead.
 */
export function useStartBlankNewsletter() {
  const navigate = useNavigate();
  const { tenant, loading: tenantLoading } = useTenant();
  const [starting, setStarting] = React.useState(false);
  const startingRef = React.useRef(false);

  const start = React.useCallback(async (options: {
    blocks?: StudioBlock[];
    name?: string;
  } = {}) => {
    if (startingRef.current) return;
    startingRef.current = true;
    setStarting(true);
    try {
      const saved = await persistCampaignDraft({
        tenantId: tenant?.id ?? null,
        campaignType: "email",
        status: "draft",
        name: options.name ?? "",
        subjectLine: "",
        preheaderText: "",
        senderName: "",
        senderEmail: "",
        contentBlocks: options.blocks?.length
          ? options.blocks
          : [
              createStudioBlock("newsletter-header"),
              createStudioBlock("plain-text"),
            ],
        smsMessage: "",
        sendAt: null,
        sendImmediately: false,
        segments: [],
        personas: [],
      });
      navigate(`/crm/campaigns/${saved.id}/studio`);
    } catch (error) {
      console.error("Couldn't create a blank newsletter", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Couldn't open a blank newsletter. Try again.",
      );
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  }, [navigate, tenant?.id]);

  return { start, starting, ready: !tenantLoading };
}
