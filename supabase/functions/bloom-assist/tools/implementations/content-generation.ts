import type { Database } from "../../../../../src/integrations/supabase/types.ts";
import type {
  JsonArray,
  JsonObject,
  JsonValue,
  PersistenceClient,
} from "../../types.ts";
import type {
  ToolExecutionContext,
  ToolImplementation,
  ToolResult,
} from "../types.ts";
import {
  getQueryClient,
  isJsonValue,
  isRecord,
  type BloomQueryClient,
} from "./shared.ts";

type TenantRow = Pick<
  Database["public"]["Tables"]["tenants"]["Row"],
  "id" | "name" | "settings"
>;
type CompanyProfileRow = Pick<
  Database["public"]["Tables"]["company_profiles"]["Row"],
  | "company_name"
  | "company_overview"
  | "brand_voice"
  | "target_audience"
  | "tone_of_writing"
  | "ideal_customer"
  | "specializations"
  | "seasonal_focus"
  | "unique_selling_points"
  | "location_info"
>;
type PersonaRow = Pick<
  Database["public"]["Tables"]["crm_personas"]["Row"],
  "id" | "persona_name" | "persona_description" | "is_custom" | "metadata"
>;
type ProductRow = Pick<
  Database["public"]["Tables"]["products"]["Row"],
  | "id"
  | "tenant_id"
  | "name"
  | "description"
  | "sku"
  | "price"
  | "currency"
  | "category"
  | "subcategory"
  | "tags"
  | "status"
  | "is_visible"
>;
type CampaignContextRow = Pick<
  Database["public"]["Tables"]["crm_campaigns"]["Row"],
  | "id"
  | "tenant_id"
  | "name"
  | "subject_line"
  | "content"
  | "delivery_method"
  | "status"
>;

type CanonicalContentType =
  | "email_body"
  | "subject_lines"
  | "sms"
  | "product_description"
  | "social_post";

type TenantGenerationContext = {
  tenant: TenantRow | null;
  profile: CompanyProfileRow | null;
  tenantName: string;
  industry: string;
  aiInstructions: string | null;
};

type RefinementContext = {
  isRefinement: boolean;
  previousContent: string | null;
  instructions: string | null;
};

const REFINEMENT_PATTERN =
  /\b(make it|shorter|more formal|less formal|more casual|add urgency|more urgent|refine|revise|rewrite|try again|alternatives|another version|improve|tighten|expand)\b/i;

function createResult(args: {
  success: boolean;
  data?: JsonValue | null;
  count?: number | null;
  message: string;
  error?: string | null;
  blockType?: ToolResult["block_type"];
}): ToolResult {
  return {
    success: args.success,
    data: args.data ?? null,
    count: args.count ?? null,
    message: args.message,
    error: args.error ?? null,
    block_type: args.blockType ?? "text",
    confirmation_required: false,
    confirmation_details: null,
  };
}

function errorResult(
  message: string,
  error = "content_generation_error",
): ToolResult {
  return createResult({ success: false, message, error, blockType: "text" });
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function readInteger(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value)
    ? value
    : fallback;
}

function jsonObjectOrNull(value: unknown): JsonObject | null {
  return isRecord(value) && Object.values(value).every(isJsonValue)
    ? (value as JsonObject)
    : null;
}

function jsonArrayOrEmpty(value: unknown): JsonArray {
  return Array.isArray(value) && value.every(isJsonValue) ? value : [];
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(readString).filter((item): item is string => Boolean(item))
    : [];
}

function normalizeContentType(rawValue: unknown): CanonicalContentType {
  const value = readString(rawValue)?.toLowerCase() ?? "email_body";
  switch (value) {
    case "email_subject":
    case "subject_line":
    case "subject_lines":
      return "subject_lines";
    case "sms_message":
    case "sms":
      return "sms";
    case "campaign_copy":
    case "email_body":
      return "email_body";
    case "social_caption":
    case "social_post":
      return "social_post";
    case "product_description":
      return "product_description";
    default:
      return "email_body";
  }
}

function extractTenantInstructions(settings: JsonObject | null): string | null {
  if (!settings) {
    return null;
  }

  return (
    readString(settings.ai_instructions) ||
    readString(settings.bloom_instructions) ||
    readString(settings.custom_ai_instructions) ||
    readString(settings.custom_instructions)
  );
}

function extractIndustry(settings: JsonObject | null): string {
  return (
    readString(settings?.industry) ||
    readString(settings?.business_type) ||
    readString(settings?.vertical) ||
    "garden center"
  );
}

async function loadTenantGenerationContext(
  client: BloomQueryClient,
  context: ToolExecutionContext,
): Promise<TenantGenerationContext> {
  const [tenantResponse, profileResponse] = await Promise.all([
    client
      .from("tenants")
      .select("id, name, settings")
      .eq("id", context.tenantId)
      .maybeSingle(),
    client
      .from("company_profiles")
      .select(
        "company_name, company_overview, brand_voice, target_audience, tone_of_writing, ideal_customer, specializations, seasonal_focus, unique_selling_points, location_info",
      )
      .eq("user_id", context.userId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (tenantResponse.error) {
    throw tenantResponse.error;
  }
  if (profileResponse.error) {
    throw profileResponse.error;
  }

  const tenant = tenantResponse.data as TenantRow | null;
  const profile = profileResponse.data as CompanyProfileRow | null;
  const settings = jsonObjectOrNull(tenant?.settings);
  const tenantName =
    readString(profile?.company_name) ||
    readString(tenant?.name) ||
    "BloomSuite tenant";

  return {
    tenant,
    profile,
    tenantName,
    industry: extractIndustry(settings),
    aiInstructions: extractTenantInstructions(settings),
  };
}

async function loadPersona(
  client: BloomQueryClient,
  context: ToolExecutionContext,
  params: JsonObject,
): Promise<PersonaRow | null> {
  const personaId = readString(params.persona_id);
  const personaName =
    readString(params.persona_name) || readString(params.target_persona);

  if (!personaId && !personaName) {
    return null;
  }

  const baseQuery = client
    .from("crm_personas")
    .select("id, persona_name, persona_description, is_custom, metadata")
    .eq("tenant_id", context.tenantId)
    .limit(1);

  const query = personaId
    ? baseQuery.eq("id", personaId)
    : baseQuery.ilike("persona_name", personaName ?? "");
  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data?.[0] ?? null) as PersonaRow | null;
}

async function loadProduct(
  client: BloomQueryClient,
  context: ToolExecutionContext,
  productId: string | null,
): Promise<ProductRow | null> {
  if (!productId) {
    return null;
  }

  const { data, error } = await client
    .from("products")
    .select(
      "id, tenant_id, name, description, sku, price, currency, category, subcategory, tags, status, is_visible",
    )
    .eq("tenant_id", context.tenantId)
    .eq("id", productId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data ?? null) as ProductRow | null;
}

async function loadCampaignContext(
  client: BloomQueryClient,
  context: ToolExecutionContext,
  campaignId: string | null,
): Promise<CampaignContextRow | null> {
  if (!campaignId) {
    return null;
  }

  const { data, error } = await client
    .from("crm_campaigns")
    .select(
      "id, tenant_id, name, subject_line, content, delivery_method, status",
    )
    .eq("tenant_id", context.tenantId)
    .eq("id", campaignId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data ?? null) as CampaignContextRow | null;
}

function personaData(
  persona: PersonaRow | null,
  fallbackName: string | null,
): JsonObject | null {
  if (!persona && !fallbackName) {
    return null;
  }

  if (!persona) {
    return {
      id: null,
      persona_name: fallbackName,
      persona_description: null,
      is_custom: false,
    };
  }

  return {
    id: persona.id,
    persona_name: persona.persona_name,
    persona_description: persona.persona_description,
    is_custom: persona.is_custom,
    metadata: jsonObjectOrNull(persona.metadata),
  };
}

function productData(
  product: ProductRow | null,
  fallback: JsonObject | null,
): JsonObject | null {
  if (product) {
    return {
      id: product.id,
      tenant_id: product.tenant_id,
      name: product.name,
      description: product.description,
      sku: product.sku,
      price: product.price,
      currency: product.currency,
      category: product.category,
      subcategory: product.subcategory,
      tags: product.tags ?? [],
      status: product.status,
      is_visible: product.is_visible,
    };
  }

  return fallback;
}

function campaignData(campaign: CampaignContextRow | null): JsonObject | null {
  if (!campaign) {
    return null;
  }

  return {
    id: campaign.id,
    tenant_id: campaign.tenant_id,
    name: campaign.name,
    subject_line: campaign.subject_line,
    content: campaign.content,
    delivery_method: campaign.delivery_method,
    status: campaign.status,
  };
}

function buildCompanyProfile(context: TenantGenerationContext): JsonObject {
  return {
    company_name: context.tenantName,
    brand_voice:
      readString(context.profile?.brand_voice) ||
      readString(context.profile?.tone_of_writing),
    target_audience:
      readString(context.profile?.target_audience) ||
      readString(context.profile?.ideal_customer),
    company_overview: context.profile?.company_overview ?? null,
    specializations: context.profile?.specializations ?? null,
    seasonal_focus: context.profile?.seasonal_focus ?? null,
    unique_selling_points: context.profile?.unique_selling_points ?? null,
    location_info: context.profile?.location_info ?? null,
  };
}

function baseInstructions(params: JsonObject): string | null {
  return (
    readString(params.prompt) ||
    readString(params.instructions) ||
    readString(params.topic) ||
    readString(params.campaign_context) ||
    readString(params.audience)
  );
}

function refinementInstructions(params: JsonObject): string | null {
  const refinement = params.refinement;
  if (typeof refinement === "string") {
    return readString(refinement);
  }

  if (isRecord(refinement)) {
    return (
      readString(refinement.instructions) ||
      readString(refinement.instruction) ||
      readString(refinement.prompt)
    );
  }

  return (
    readString(params.refinement_instructions) ||
    readString(params.instructions) ||
    readString(params.prompt)
  );
}

function refinementPreviousContent(params: JsonObject): string | null {
  const refinement = params.refinement;
  if (isRecord(refinement)) {
    return (
      readString(refinement.previous_content) ||
      readString(refinement.original_content)
    );
  }

  return (
    readString(params.previous_content) || readString(params.original_content)
  );
}

function looksLikeRefinement(params: JsonObject): boolean {
  if (params.refinement !== undefined || readString(params.previous_content)) {
    return true;
  }

  const text = [params.prompt, params.instructions, params.topic]
    .map(readString)
    .filter(Boolean)
    .join(" ");
  return REFINEMENT_PATTERN.test(text);
}

function generatedContentText(data: JsonObject | null): string | null {
  if (!data) {
    return null;
  }

  const direct =
    readString(data.text) ||
    readString(data.content) ||
    readString(data.message);
  if (direct) {
    return direct;
  }

  const options = stringArray(data.options);
  return options.length > 0 ? options.join("\n") : null;
}

function toolOutputData(value: unknown): JsonObject | null {
  if (!isRecord(value)) {
    return null;
  }

  return jsonObjectOrNull(value.data);
}

async function loadPreviousGeneratedContent(
  serviceClient: PersistenceClient,
  context: ToolExecutionContext,
): Promise<string | null> {
  const { data, error } = await serviceClient
    .from("bloom_tool_executions")
    .select("tool_output, created_at")
    .eq("tenant_id", context.tenantId)
    .eq("user_id", context.userId)
    .eq("conversation_id", context.conversationId)
    .eq("tool_name", "generate_content")
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    throw error;
  }

  const rows = Array.isArray(data) ? data : [];
  for (const row of rows) {
    if (!isRecord(row)) {
      continue;
    }

    const content = generatedContentText(toolOutputData(row.tool_output));
    if (content) {
      return content;
    }
  }

  return null;
}

async function resolveRefinement(
  params: JsonObject,
  context: ToolExecutionContext,
): Promise<RefinementContext> {
  if (!looksLikeRefinement(params)) {
    return { isRefinement: false, previousContent: null, instructions: null };
  }

  const explicitPrevious = refinementPreviousContent(params);
  const previousContent =
    explicitPrevious ||
    (await loadPreviousGeneratedContent(context.serviceClient, context));

  if (!previousContent) {
    return { isRefinement: false, previousContent: null, instructions: null };
  }

  return {
    isRefinement: true,
    previousContent,
    instructions: refinementInstructions(params) || baseInstructions(params),
  };
}

function buildInstructionText(args: {
  params: JsonObject;
  contentType: CanonicalContentType;
  tenantContext: TenantGenerationContext;
  persona: JsonObject | null;
  product: JsonObject | null;
  campaign: JsonObject | null;
  refinement: RefinementContext;
}): string {
  const requestedInstructions =
    baseInstructions(args.params) ?? "Generate marketing content.";
  const tone = readString(args.params.tone) ?? "professional";
  const audience =
    readString(args.params.audience) || readString(args.params.target_audience);
  const contextLines = [
    `Tenant: ${args.tenantContext.tenantName}`,
    `Industry: ${args.tenantContext.industry}`,
    `Tone: ${tone}`,
    audience ? `Audience: ${audience}` : null,
    args.persona
      ? `Persona: ${readString(args.persona.persona_name) ?? "specified persona"}`
      : null,
    args.product ? `Product context: ${JSON.stringify(args.product)}` : null,
    args.campaign ? `Campaign context: ${JSON.stringify(args.campaign)}` : null,
    args.tenantContext.aiInstructions
      ? `Store AI instructions: ${args.tenantContext.aiInstructions}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  if (args.refinement.isRefinement) {
    return [
      `Refine the previous ${args.contentType.replaceAll("_", " ")} using the user's instruction.`,
      `Refinement instruction: ${args.refinement.instructions ?? requestedInstructions}`,
      "Previous content:",
      args.refinement.previousContent,
      "Context:",
      contextLines,
    ].join("\n\n");
  }

  return [requestedInstructions, "Context:", contextLines].join("\n\n");
}

function currentMonth(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${now.getFullYear()}-${month}`;
}

function socialContentType(
  params: JsonObject,
): "tips" | "feature" | "workshop" | "inspiration" | "behind-scenes" {
  const value =
    readString(params.social_content_type) ||
    readString(params.post_type) ||
    "tips";
  switch (value) {
    case "feature":
    case "workshop":
    case "inspiration":
    case "behind-scenes":
      return value;
    default:
      return "tips";
  }
}

function edgeModel(contentType: CanonicalContentType): string {
  switch (contentType) {
    case "subject_lines":
    case "sms":
      return "gpt-4.1-2025-04-14";
    case "email_body":
    case "product_description":
    case "social_post":
      return "gpt-4o-mini";
  }
}

async function invokeEdgeFunction(
  context: ToolExecutionContext,
  functionName: string,
  body: JsonObject,
): Promise<JsonObject> {
  const client = context.dataClient;
  if (!client) {
    throw new Error("Authenticated content generation client was unavailable.");
  }

  const { data, error } = await client.functions.invoke(functionName, { body });
  if (error) {
    throw error;
  }

  const response = jsonObjectOrNull(data);
  if (!response) {
    throw new Error(`${functionName} returned an invalid response.`);
  }

  if (readString(response.error)) {
    throw new Error(readString(response.error) ?? `${functionName} failed.`);
  }

  return response;
}

function commonData(args: {
  contentType: CanonicalContentType;
  functionName: string;
  tone: string;
  tenantContext: TenantGenerationContext;
  persona: JsonObject | null;
  product: JsonObject | null;
  campaign: JsonObject | null;
  refinement: RefinementContext;
}): JsonObject {
  return {
    content_type: args.contentType,
    model: edgeModel(args.contentType),
    edge_function: args.functionName,
    refinement: args.refinement.isRefinement,
    tone: args.tone,
    tenant_context: {
      tenant_id: args.tenantContext.tenant?.id ?? null,
      tenant_name: args.tenantContext.tenantName,
      industry: args.tenantContext.industry,
      has_ai_instructions: Boolean(args.tenantContext.aiInstructions),
    },
    persona: args.persona,
    product: args.product,
    campaign: args.campaign,
  };
}

function subjectLinesFromResponse(response: JsonObject): string[] {
  const direct = stringArray(response.subjectLines);
  if (direct.length > 0) {
    return direct.slice(0, 5);
  }

  const alternatives = stringArray(response.options);
  if (alternatives.length > 0) {
    return alternatives.slice(0, 5);
  }

  const text = readString(response.content) || readString(response.text);
  if (!text) {
    return [];
  }

  return text
    .split("\n")
    .map((line) => line.replace(/^\d+[.)]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 5);
}

function generatedContentMessage(
  contentType: CanonicalContentType,
  generated: JsonObject,
): string {
  if (contentType === "subject_lines") {
    const numbered = stringArray(generated.numbered_options);
    return numbered.length > 0
      ? `Generated subject line options:\n${numbered.join("\n")}`
      : "Generated subject line options.";
  }

  if (contentType === "sms") {
    return `Generated SMS copy (${generated.character_count ?? 0} characters).`;
  }

  return `Generated ${contentType.replaceAll("_", " ")} content.`;
}

function contextPayload(args: {
  tenantContext: TenantGenerationContext;
  persona: JsonObject | null;
  product: JsonObject | null;
  campaign: JsonObject | null;
  refinement: RefinementContext;
  params: JsonObject;
}): JsonObject {
  return {
    tenant_name: args.tenantContext.tenantName,
    industry: args.tenantContext.industry,
    ai_instructions: args.tenantContext.aiInstructions,
    companyProfile: buildCompanyProfile(args.tenantContext),
    persona: args.persona,
    personas: args.persona ? [args.persona] : [],
    product: args.product,
    campaign: args.campaign,
    tone: readString(args.params.tone) ?? "professional",
    audience:
      readString(args.params.audience) ||
      readString(args.params.target_audience),
    refinement: args.refinement.isRefinement,
    previous_content: args.refinement.previousContent,
    refinement_instructions: args.refinement.instructions,
  };
}

async function generateByType(args: {
  context: ToolExecutionContext;
  params: JsonObject;
  contentType: CanonicalContentType;
  prompt: string;
  tenantContext: TenantGenerationContext;
  persona: JsonObject | null;
  product: JsonObject | null;
  campaign: JsonObject | null;
  refinement: RefinementContext;
}): Promise<{ functionName: string; generated: JsonObject; count: number }> {
  const sharedContext = contextPayload(args);
  const topic =
    readString(args.params.topic) ||
    readString(args.params.prompt) ||
    args.prompt;

  switch (args.contentType) {
    case "subject_lines": {
      const functionName = "generate-subject-lines";
      const response = await invokeEdgeFunction(args.context, functionName, {
        ...sharedContext,
        topic,
        content: args.refinement.previousContent ?? args.prompt,
        requested_options: 5,
      });
      const options = subjectLinesFromResponse(response);
      const numberedOptions = options.map(
        (option, index) => `${index + 1}. ${option}`,
      );
      return {
        functionName,
        count: options.length,
        generated: {
          ...commonData({
            contentType: args.contentType,
            functionName,
            tone: readString(args.params.tone) ?? "professional",
            tenantContext: args.tenantContext,
            persona: args.persona,
            product: args.product,
            campaign: args.campaign,
            refinement: args.refinement,
          }),
          options,
          numbered_options: numberedOptions,
        },
      };
    }
    case "sms": {
      const functionName = "generate-sms";
      const maxChars = readInteger(
        args.params.max_chars,
        readString(args.params.length) === "short" ? 160 : 320,
      );
      const response = await invokeEdgeFunction(args.context, functionName, {
        ...sharedContext,
        topic: `${topic}\n\nKeep the SMS at or under ${maxChars} characters. Do not include Reply STOP language.`,
        max_chars: maxChars,
      });
      const text =
        readString(response.message) || readString(response.content) || "";
      return {
        functionName,
        count: text ? 1 : 0,
        generated: {
          ...commonData({
            contentType: args.contentType,
            functionName,
            tone: readString(args.params.tone) ?? "professional",
            tenantContext: args.tenantContext,
            persona: args.persona,
            product: args.product,
            campaign: args.campaign,
            refinement: args.refinement,
          }),
          text,
          character_count: text.length,
          character_limit: maxChars,
          within_limit: text.length <= maxChars,
        },
      };
    }
    case "social_post": {
      const functionName = "generate-social-content";
      const platform =
        readString(args.params.platform) === "instagram"
          ? "instagram"
          : "facebook";
      const response = await invokeEdgeFunction(args.context, functionName, {
        ...sharedContext,
        platform,
        theme: topic,
        themeDescription: args.prompt,
        month: readString(args.params.month) ?? currentMonth(),
        weekNumber: readInteger(args.params.week_number, 1),
        contentType: socialContentType(args.params),
        companyProfile: buildCompanyProfile(args.tenantContext),
      });
      const text = readString(response.content) || "";
      return {
        functionName,
        count: text ? 1 : 0,
        generated: {
          ...commonData({
            contentType: args.contentType,
            functionName,
            tone: readString(args.params.tone) ?? "professional",
            tenantContext: args.tenantContext,
            persona: args.persona,
            product: args.product,
            campaign: args.campaign,
            refinement: args.refinement,
          }),
          platform,
          text,
          image_query: readString(response.imageQuery),
          hashtags: readString(response.hashtags),
        },
      };
    }
    case "product_description":
    case "email_body": {
      const functionName = "generate-email-content";
      const response = await invokeEdgeFunction(args.context, functionName, {
        ...sharedContext,
        prompt: args.prompt,
        type:
          args.contentType === "email_body"
            ? "email_block"
            : "product_description",
        campaignTitle: readString(args.params.campaign_title) || topic,
        campaignContext: args.prompt,
        postType: args.contentType === "email_body" ? "newsletter" : "product",
        blockIndex: 0,
        previousBlocks: jsonArrayOrEmpty(args.params.previous_blocks),
        totalBlocks: 1,
      });
      const text =
        readString(response.content) || readString(response.text) || "";
      return {
        functionName,
        count: text ? 1 : 0,
        generated: {
          ...commonData({
            contentType: args.contentType,
            functionName,
            tone: readString(args.params.tone) ?? "professional",
            tenantContext: args.tenantContext,
            persona: args.persona,
            product: args.product,
            campaign: args.campaign,
            refinement: args.refinement,
          }),
          title: readString(response.title),
          text,
          cta_text: readString(response.cta_text),
          cta_url: readString(response.cta_url),
          raw: response,
        },
      };
    }
  }
}

export const generateContent: ToolImplementation = async (
  params: JsonObject,
  context: ToolExecutionContext,
): Promise<ToolResult> => {
  const contentType = normalizeContentType(params.content_type);
  const instructions = baseInstructions(params);
  if (!instructions) {
    return errorResult(
      "Content generation requires a topic, prompt, or instructions.",
      "validation_error",
    );
  }

  const client = getQueryClient(context);
  const [tenantContext, persona, product, campaign, refinement] =
    await Promise.all([
      loadTenantGenerationContext(client, context),
      loadPersona(client, context, params),
      loadProduct(client, context, readString(params.product_id)),
      loadCampaignContext(client, context, readString(params.campaign_id)),
      resolveRefinement(params, context),
    ]);

  if (readString(params.product_id) && !product) {
    return errorResult("Product not found for this tenant.", "not_found");
  }
  if (readString(params.campaign_id) && !campaign) {
    return errorResult("Campaign not found for this tenant.", "not_found");
  }

  const personaPayload = personaData(
    persona,
    readString(params.target_persona) || readString(params.audience),
  );
  const productPayload = productData(
    product,
    jsonObjectOrNull(params.product_context),
  );
  const campaignPayload =
    campaignData(campaign) || jsonObjectOrNull(params.campaign_context);
  const prompt = buildInstructionText({
    params,
    contentType,
    tenantContext,
    persona: personaPayload,
    product: productPayload,
    campaign: campaignPayload,
    refinement,
  });
  const { generated, functionName, count } = await generateByType({
    context,
    params,
    contentType,
    prompt,
    tenantContext,
    persona: personaPayload,
    product: productPayload,
    campaign: campaignPayload,
    refinement,
  });

  return createResult({
    success: true,
    message: generatedContentMessage(contentType, generated),
    blockType: "text",
    data: {
      ...generated,
      edge_function: functionName,
    },
    count,
  });
};
