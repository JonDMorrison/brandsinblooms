import { generateEmailHtml } from "../../../../../src/lib/studio/emailHtmlGenerator.ts";
import { buildBotanicalEditorial, isBotanicalTemplateId, parseBotanicalBrief } from "../../../../../src/lib/studio/botanicalEditorial.ts";
import { COMPANY_PROFILE_WITH_DESIGN_SYSTEM_SELECT, resolveDesignSystem, type ServerCompanyProfileShape } from "../../../_shared/resolveDesignSystem.ts";
import type { JsonObject } from "../../types.ts";
import type { ToolExecutionContext } from "../types.ts";
import { getQueryClient } from "./shared.ts";

export function validateNewsletterTemplate(params: JsonObject): void {
  if (params.template_id === undefined && params.newsletter_brief === undefined) return;
  if (!isBotanicalTemplateId(params.template_id)) throw new Error("Choose a supported Botanical template.");
  if (params.delivery_method === "sms" || params.campaign_type === "sms") throw new Error("Newsletter templates are for email drafts.");
  parseBotanicalBrief(params.newsletter_brief);
}

export async function newsletterTemplateMetadata(params: JsonObject, context: ToolExecutionContext): Promise<{ metadata: JsonObject; content?: string }> {
  if (params.template_id === undefined) return { metadata: {} };
  validateNewsletterTemplate(params);
  if (!isBotanicalTemplateId(params.template_id)) throw new Error("Unknown newsletter template.");
  const client = getQueryClient(context);
  // Profiles are user-owned. Resolve their owners through this tenant first,
  // including when an administrator is operating a different client account.
  const members = await client.from("users").select("id").eq("tenant_id", context.tenantId);
  if (members.error) throw members.error;
  const ids = (members.data || []).map((member) => member.id);
  if (!ids.length) throw new Error("This account has no brand profile owner.");
  const ownerIds = ids.includes(context.userId) ? [context.userId] : ids;
  const profiles = await client.from("company_profiles")
    .select(COMPANY_PROFILE_WITH_DESIGN_SYSTEM_SELECT)
    .in("user_id", ownerIds).is("deleted_at", null).limit(2);
  if (profiles.error) throw profiles.error;
  if (!profiles.data?.length) throw new Error("Complete this account's brand profile before creating a branded newsletter.");
  if (profiles.data.length > 1) throw new Error("This account has multiple brand profiles. Create the newsletter in its Design Studio to use the selected brand.");
  const design = resolveDesignSystem(profiles.data[0] as unknown as ServerCompanyProfileShape);
  const brief = parseBotanicalBrief(params.newsletter_brief);
  const blocks = buildBotanicalEditorial(params.template_id, design, brief);
  const metadata = JSON.parse(JSON.stringify({
    templateId: params.template_id,
    templateVersion: 1,
    contentBlocks: blocks,
  })) as JsonObject;
  return { metadata, content: generateEmailHtml({
    blocks, subject: typeof params.subject_line === "string" ? params.subject_line : "",
    previewText: typeof params.preheader_text === "string" ? params.preheader_text : "",
    footer: null, designSystem: design,
  }) };
}
