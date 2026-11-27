// The postal address a campaign email shows in its footer: the footer
// block's own address, else the business profile's. Placeholder text
// ("123 Business St, ...") never counts. An empty result blocks sending,
// because CASL and CAN-SPAM require a postal address.
import { resolveFooterPostalAddress } from "../../../src/lib/studio/businessPlaceholders.ts";
import {
  resolveDesignSystem,
  type ServerCompanyProfileShape,
} from "./resolveDesignSystem.ts";

interface FooterLike {
  type?: unknown;
  address?: unknown;
}

export function resolveCampaignPostalAddress(
  contentBlocks: ReadonlyArray<FooterLike> | null | undefined,
  companyProfile: ServerCompanyProfileShape | null | undefined,
): string {
  const footer = (contentBlocks ?? []).find((block) => block?.type === "footer");
  const footerAddress = typeof footer?.address === "string" ? footer.address : "";
  const company = resolveDesignSystem(companyProfile)?.company;
  return resolveFooterPostalAddress(
    footerAddress,
    company?.addressLines || company?.address || "",
  );
}
