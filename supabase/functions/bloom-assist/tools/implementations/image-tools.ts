import {
  buildImageClimateConstraints,
  extractClimateProfile,
} from "../../../_shared/climateConstraints.ts";
import { validateLocationForGeneration } from "../../../_shared/locationGuard.ts";
import type { JsonArray, JsonObject, JsonValue } from "../../types.ts";
import type {
  ToolExecutionContext,
  ToolImplementation,
  ToolResult,
} from "../types.ts";
import { isRecord } from "./shared.ts";

type ImageStyle =
  | "photorealistic"
  | "illustration"
  | "flat"
  | "watercolor"
  | "sketch"
  | "product_photo"
  | "lifestyle"
  | "seasonal_display"
  | "social_graphic"
  | "email_header";

type AspectRatio =
  | "square"
  | "landscape"
  | "portrait"
  | "1:1"
  | "4:3"
  | "16:9"
  | "9:16";

type ImageChannel = "newsletter" | "blog" | "instagram" | "facebook";

type ImageDimensions = {
  width: number;
  height: number;
};

type EnhancePromptResult = {
  prompt: string;
  usedEnhancement: boolean;
  errorMessage: string | null;
};

type GeneratedImageResponse = {
  imageUrl: string;
  imageId: string;
  globalImageId: string | null;
  generationTime: number | null;
  storagePath: string | null;
  channel: string | null;
  tags: JsonArray;
};

type ClimateGuardrailResult = {
  applied: boolean;
  constraintsLoaded: boolean;
};

const IMAGE_GUIDELINE_MESSAGE =
  "This image request couldn't be processed due to content guidelines. Please try a different description.";

const DEFAULT_STYLE: ImageStyle = "photorealistic";
const DEFAULT_ASPECT_RATIO: AspectRatio = "landscape";
const GENERATION_MODEL = "google/gemini-2.5-flash-image-preview";

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
  error = "image_generation_error",
): ToolResult {
  return createResult({ success: false, message, error, blockType: "text" });
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readJsonObject(value: unknown): JsonObject | null {
  return isRecord(value) && Object.values(value).every(isJsonValue)
    ? (value as JsonObject)
    : null;
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null) return true;
  if (typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  return isRecord(value) && Object.values(value).every(isJsonValue);
}

function readJsonArray(value: unknown): JsonArray {
  return Array.isArray(value) && value.every(isJsonValue) ? value : [];
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (isRecord(error) && typeof error.message === "string") {
    return error.message;
  }
  return "Unknown image generation error";
}

function normalizeStyle(value: unknown): ImageStyle {
  const rawStyle = readString(value)?.toLowerCase();
  switch (rawStyle) {
    case "illustration":
    case "flat":
    case "watercolor":
    case "sketch":
    case "product_photo":
    case "lifestyle":
    case "seasonal_display":
    case "social_graphic":
    case "email_header":
      return rawStyle;
    default:
      return DEFAULT_STYLE;
  }
}

function normalizeAspectRatio(value: unknown): AspectRatio {
  const rawAspectRatio = readString(value)?.toLowerCase();
  switch (rawAspectRatio) {
    case "square":
    case "portrait":
    case "1:1":
    case "4:3":
    case "16:9":
    case "9:16":
      return rawAspectRatio;
    default:
      return DEFAULT_ASPECT_RATIO;
  }
}

function styleInstruction(style: ImageStyle): string {
  switch (style) {
    case "illustration":
      return "Detailed editorial garden illustration with botanical accuracy.";
    case "flat":
      return "Clean flat illustration with simple shapes and no text.";
    case "watercolor":
      return "Soft watercolor-inspired garden artwork with natural textures.";
    case "sketch":
      return "Refined botanical sketch style with natural composition.";
    case "product_photo":
      return "Product-focused plant photography with the product as the hero.";
    case "lifestyle":
      return "Lifestyle garden scene with inviting natural light.";
    case "seasonal_display":
      return "Seasonal garden-center display where plants remain the focus.";
    case "social_graphic":
      return "Eye-catching social creative without text overlays.";
    case "email_header":
      return "Wide email-header composition with room for surrounding email layout.";
    case "photorealistic":
    default:
      return "Photorealistic professional garden marketing image.";
  }
}

function aspectInstruction(aspectRatio: AspectRatio): string {
  switch (aspectRatio) {
    case "square":
    case "1:1":
      return "Square 1:1 composition.";
    case "portrait":
    case "9:16":
      return "Portrait-oriented composition suitable for vertical placement.";
    case "4:3":
      return "Landscape 4:3 composition.";
    case "landscape":
    case "16:9":
    default:
      return "Landscape 16:9 composition.";
  }
}

function dimensionsFor(aspectRatio: AspectRatio): ImageDimensions {
  switch (aspectRatio) {
    case "square":
    case "1:1":
      return { width: 1024, height: 1024 };
    case "portrait":
    case "9:16":
      return { width: 1024, height: 1792 };
    case "4:3":
      return { width: 1344, height: 1024 };
    case "landscape":
    case "16:9":
    default:
      return { width: 1792, height: 1024 };
  }
}

function deriveChannel(
  style: ImageStyle,
  aspectRatio: AspectRatio,
): ImageChannel {
  if (style === "email_header") {
    return "newsletter";
  }
  if (style === "social_graphic") {
    return aspectRatio === "square" || aspectRatio === "1:1"
      ? "instagram"
      : "facebook";
  }
  if (
    aspectRatio === "square" ||
    aspectRatio === "1:1" ||
    aspectRatio === "portrait" ||
    aspectRatio === "9:16"
  ) {
    return "instagram";
  }
  return "newsletter";
}

function readContext(params: JsonObject): JsonObject | null {
  return (
    readJsonObject(params.context) ?? readJsonObject(params.campaign_context)
  );
}

function contextLine(context: JsonObject | null): string | null {
  if (!context) {
    return null;
  }

  const relatedType =
    readString(context.related_entity_type) ?? readString(context.entity_type);
  const relatedName =
    readString(context.related_entity_name) ?? readString(context.entity_name);
  const campaignName =
    readString(context.campaignName) ?? readString(context.campaign_name);
  const contentSummary =
    readString(context.contentSummary) ?? readString(context.content_summary);
  const parts = [
    relatedType && relatedName ? `${relatedType}: ${relatedName}` : relatedName,
    campaignName ? `Campaign: ${campaignName}` : null,
    contentSummary ? `Context: ${contentSummary}` : null,
  ].filter((part): part is string => Boolean(part));

  return parts.length > 0 ? parts.join(". ") : null;
}

function campaignContextForEnhancement(
  context: JsonObject | null,
  aspectRatio: AspectRatio,
): JsonObject | null {
  if (!context) {
    return {
      aspectRatioHint: aspectInstruction(aspectRatio),
    };
  }

  return {
    aspectRatioHint: aspectInstruction(aspectRatio),
    blockLabel:
      readString(context.blockLabel) ?? readString(context.block_label) ?? null,
    blockType:
      readString(context.blockType) ?? readString(context.block_type) ?? null,
    campaignName:
      readString(context.campaignName) ??
      readString(context.campaign_name) ??
      null,
    campaignType:
      readString(context.campaignType) ??
      readString(context.campaign_type) ??
      null,
    contentSummary:
      readString(context.contentSummary) ??
      readString(context.content_summary) ??
      null,
  };
}

function buildEnrichedPrompt(
  params: JsonObject,
  style: ImageStyle,
  aspectRatio: AspectRatio,
): string {
  const prompt = readString(params.prompt) ?? "Seasonal garden marketing image";
  const context = readContext(params);
  const lines = [
    prompt,
    styleInstruction(style),
    aspectInstruction(aspectRatio),
    contextLine(context),
  ].filter((line): line is string => Boolean(line));

  return lines.join(" ").slice(0, 1800);
}

function contentTitle(params: JsonObject, context: JsonObject | null): string {
  return (
    readString(params.title) ??
    readString(context?.campaignName) ??
    readString(context?.campaign_name) ??
    readString(context?.related_entity_name) ??
    (readString(params.prompt) ?? "Bloom generated image").slice(0, 120)
  );
}

async function ensureLocationAllowed(
  context: ToolExecutionContext,
): Promise<ToolResult | null> {
  const locationResult = await validateLocationForGeneration(context.userId);
  if (locationResult.isValid) {
    return null;
  }

  return errorResult(
    "Please confirm your business location before generating localized garden imagery.",
    "location_guardrail_blocked",
  );
}

async function loadClimateGuardrails(
  context: ToolExecutionContext,
): Promise<ClimateGuardrailResult> {
  const { data, error } = await context.serviceClient
    .from("company_profiles")
    .select(
      "postal_code, city, state_province, country, location_info, latitude, longitude, climate_archetype, climate_label, climate_confidence, usda_zone, first_frost_date, last_frost_date",
    )
    .eq("user_id", context.userId)
    .maybeSingle();

  if (error || !data) {
    buildImageClimateConstraints(null);
    return { applied: true, constraintsLoaded: false };
  }

  const climateProfile = extractClimateProfile(data);
  const constraints = buildImageClimateConstraints(climateProfile);
  return {
    applied: constraints.trim().length > 0,
    constraintsLoaded: Boolean(climateProfile),
  };
}

async function enhancePrompt(
  context: ToolExecutionContext,
  prompt: string,
  campaignContext: JsonObject | null,
): Promise<EnhancePromptResult> {
  const client = context.dataClient;
  if (!client) {
    return {
      prompt,
      usedEnhancement: false,
      errorMessage: "Authenticated image prompt client was unavailable.",
    };
  }

  try {
    const { data, error } = await client.functions.invoke(
      "enhance-image-prompt",
      {
        body: {
          prompt,
          campaignContext,
        },
      },
    );

    if (error) {
      return {
        prompt,
        usedEnhancement: false,
        errorMessage: errorMessage(error),
      };
    }

    const response = readJsonObject(data);
    const enhancedPrompt = readString(response?.enhancedPrompt);
    return enhancedPrompt
      ? { prompt: enhancedPrompt, usedEnhancement: true, errorMessage: null }
      : {
          prompt,
          usedEnhancement: false,
          errorMessage: "Prompt enhancement returned no enhanced prompt.",
        };
  } catch (error) {
    return {
      prompt,
      usedEnhancement: false,
      errorMessage: errorMessage(error),
    };
  }
}

function parseGeneratedImageResponse(data: unknown): GeneratedImageResponse {
  const response = readJsonObject(data);
  const imageUrl = readString(response?.imageUrl);
  const imageId = readString(response?.imageId);
  if (!response || !imageUrl || !imageId) {
    throw new Error("generate-ai-image returned an invalid response.");
  }

  const metadata = readJsonObject(response.metadata);
  return {
    imageUrl,
    imageId,
    globalImageId: readString(response.globalImageId),
    generationTime: readNumber(metadata?.generationTime),
    storagePath: readString(metadata?.storagePath),
    channel: readString(metadata?.channel),
    tags: readJsonArray(metadata?.tags),
  };
}

function isGuidelineError(error: unknown): boolean {
  const message = errorMessage(error).toLowerCase();
  return (
    message.includes("content") ||
    message.includes("policy") ||
    message.includes("guideline") ||
    message.includes("safety") ||
    message.includes("blocked")
  );
}

async function generateImage(
  context: ToolExecutionContext,
  body: JsonObject,
): Promise<GeneratedImageResponse> {
  const client = context.dataClient;
  if (!client) {
    throw new Error("Authenticated image generation client was unavailable.");
  }

  const { data, error } = await client.functions.invoke("generate-ai-image", {
    body,
  });
  if (error) {
    throw error;
  }

  const response = readJsonObject(data);
  const responseError = readString(response?.error);
  if (responseError) {
    throw new Error(responseError);
  }

  return parseGeneratedImageResponse(data);
}

export const executeGenerateImage: ToolImplementation = async (
  params: JsonObject,
  context: ToolExecutionContext,
): Promise<ToolResult> => {
  const locationBlock = await ensureLocationAllowed(context);
  if (locationBlock) {
    return locationBlock;
  }

  const style = normalizeStyle(params.style);
  const aspectRatio = normalizeAspectRatio(params.aspect_ratio);
  const dimensions = dimensionsFor(aspectRatio);
  const imageContext = readContext(params);
  const originalPrompt =
    readString(params.prompt) ?? "Seasonal garden marketing image";
  const enrichedPrompt = buildEnrichedPrompt(params, style, aspectRatio);
  const campaignContext = campaignContextForEnhancement(
    imageContext,
    aspectRatio,
  );
  const enhancement = await enhancePrompt(
    context,
    enrichedPrompt,
    campaignContext,
  );
  const climateGuardrails = await loadClimateGuardrails(context);
  const channel = deriveChannel(style, aspectRatio);
  const title = contentTitle(params, imageContext);
  const previousImageUrl = readString(params.previous_image_url);
  const refinementInstruction = readString(params.refinement_instruction);

  try {
    const generated = await generateImage(context, {
      contentContext: enhancement.prompt,
      contentTitle: title,
      channel,
      uploadToStorage: true,
      storageBucket: "global-ai-images",
      userId: context.userId,
    });

    const data: JsonObject = {
      tenant_id: context.tenantId,
      image_url: generated.imageUrl,
      url: generated.imageUrl,
      image_id: generated.imageId,
      global_image_id: generated.globalImageId,
      storage_path: generated.storagePath,
      original_prompt: originalPrompt,
      enriched_prompt: enrichedPrompt,
      enhanced_prompt: enhancement.prompt,
      prompt_enhancement_used: enhancement.usedEnhancement,
      prompt_enhancement_error: enhancement.errorMessage,
      generation_model: GENERATION_MODEL,
      edge_function: "generate-ai-image",
      style,
      aspect_ratio: aspectRatio,
      dimensions,
      channel: generated.channel ?? channel,
      generation_time_seconds: generated.generationTime,
      tags: generated.tags,
      previous_image_url: previousImageUrl,
      refinement: Boolean(previousImageUrl || refinementInstruction),
      refinement_instruction: refinementInstruction,
      climate_constraints_applied: climateGuardrails.applied,
      climate_constraints_loaded: climateGuardrails.constraintsLoaded,
      location_guardrail_applied: true,
      follow_up_chips: [
        "Make it brighter",
        "Add more flowers",
        "Try a different composition",
      ],
    };

    return createResult({
      success: true,
      message: previousImageUrl
        ? "Generated a refined image."
        : "Generated an image.",
      blockType: "image",
      data,
      count: 1,
    });
  } catch (error) {
    if (isGuidelineError(error)) {
      return errorResult(IMAGE_GUIDELINE_MESSAGE, "content_guidelines");
    }

    return errorResult(errorMessage(error));
  }
};

export const generateImageTool = executeGenerateImage;
