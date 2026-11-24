import * as React from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/utils/toast";
import { useTenant } from "@/hooks/useTenant";
import { persistCampaignDraft } from "@/lib/crm/campaignEditor";
import { createStudioBlock } from "@/lib/studio/blockFactory";
import { buildStudioDesignSystem } from "@/lib/studio/designSystem";
import { useCompanyInfo } from "@/hooks/useCompanyInfo";
import { buildCampaignOrigin } from "@/lib/crm/campaignOrigin";
import type { StudioBlock } from "@/types/studioBlocks";

/**
 * "Open blank editor": create a draft with a blank canvas (a header and an
 * empty paragraph; the footer is added on save) and open it straight in
 * Design Studio. No setup form or layout picker on this path. Pass `blocks`
 * (and `origin`, e.g. saved_template:<id>) to start from a saved template.
 * The origin is recorded once at insert; it defaults to "blank".
 */
export function useStartBlankNewsletter() {
  const navigate = useNavigate();
  const { tenant, loading: tenantLoading } = useTenant();
  const { companyInfo, isLoading: companyLoading } = useCompanyInfo();
  // The blank canvas starts in the tenant's branding (logo, store name,
  // brand colours); the footer is hydrated from the same profile on save.
  const designSystem = React.useMemo(
    () => buildStudioDesignSystem(companyInfo),
    [companyInfo],
  );
  const [starting, setStarting] = React.useState(false);
  const startingRef = React.useRef(false);

  const start = React.useCallback(async (options: {
    blocks?: StudioBlock[];
    name?: string;
    origin?: string;
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
              createStudioBlock("newsletter-header", designSystem),
              createStudioBlock("plain-text", designSystem),
            ],
        smsMessage: "",
        sendAt: null,
        sendImmediately: false,
        segments: [],
        personas: [],
        origin: options.origin ?? buildCampaignOrigin("blank"),
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
  }, [designSystem, navigate, tenant?.id]);

  return { start, starting, ready: !tenantLoading && !companyLoading };
}
