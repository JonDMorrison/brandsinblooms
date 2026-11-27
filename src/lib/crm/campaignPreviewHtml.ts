import type { StudioDesignSystem } from "@/lib/studio/designSystem";
import { generateEmailHtml } from "@/lib/studio/emailHtmlGenerator";
import type { StudioBlock } from "@/types/studioBlocks";

const SAMPLE_CUSTOMER = {
  first_name: "Mira",
  last_name: "Hart",
  email: "preview@studio-preview.test",
  phone: "(555) 014-8821",
};

function stripScriptTags(html: string) {
  return html.replace(
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    "",
  );
}

function buildPreviewMergeData(designSystem: StudioDesignSystem) {
  const currentDate = new Date().toLocaleDateString();
  const currentYear = new Date().getFullYear().toString();
  const companyName = designSystem.company.name || "Your Company";
  const companyAddress = designSystem.company.addressLines || "";
  const companyPhone = designSystem.company.phone || "";
  const companyEmail = designSystem.company.email || "";
  const companyWebsite = designSystem.company.websiteUrl || "";

  return {
    first_name: SAMPLE_CUSTOMER.first_name,
    last_name: SAMPLE_CUSTOMER.last_name,
    email: SAMPLE_CUSTOMER.email,
    phone: SAMPLE_CUSTOMER.phone,
    lifetime_value: "0",
    total_spent: "0",
    first_purchase_date: "",
    last_purchase_date: "",
    "customer.first_name": SAMPLE_CUSTOMER.first_name,
    "customer.last_name": SAMPLE_CUSTOMER.last_name,
    "customer.email": SAMPLE_CUSTOMER.email,
    "customer.phone": SAMPLE_CUSTOMER.phone,
    "customer.name": SAMPLE_CUSTOMER.first_name,
    customer_name: SAMPLE_CUSTOMER.first_name,
    customerName: SAMPLE_CUSTOMER.first_name,
    firstName: SAMPLE_CUSTOMER.first_name,
    lastName: SAMPLE_CUSTOMER.last_name,
    "company.name": companyName,
    "company.address": companyAddress,
    "company.phone": companyPhone,
    "company.email": companyEmail,
    "company.website": companyWebsite,
    company_name: companyName,
    companyName: companyName,
    "system.unsubscribe_url": "#unsubscribe",
    "system.preferences_url": "#preferences",
    "system.current_year": currentYear,
    "system.current_date": currentDate,
    unsubscribe_url: "#unsubscribe",
    unsubscribeUrl: "#unsubscribe",
  };
}

/**
 * The email exactly as the editor previews it: the real email renderer with a
 * sample customer's merge data, scripts removed. Shared by this card, the
 * design thumbnail and the editor's live preview.
 */
export function buildCampaignPreviewHtml({
  blocks,
  subjectLine,
  previewText,
  designSystem,
}: {
  blocks: StudioBlock[];
  subjectLine: string;
  previewText: string;
  designSystem: StudioDesignSystem;
}) {
  return stripScriptTags(
    generateEmailHtml({
      blocks,
      subject: subjectLine || "Newsletter preview",
      previewText,
      footer: blocks.find((block) => block.type === "footer") ?? null,
      mergeData: buildPreviewMergeData(designSystem),
      designSystem,
    }),
  );
}
