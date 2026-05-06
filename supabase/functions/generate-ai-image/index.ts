import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  validateLocationForGeneration,
  locationBlockedResponse,
} from "../_shared/locationGuard.ts";
import {
  buildImageClimateConstraints,
  extractClimateProfile,
} from "../_shared/climateConstraints.ts";
import { getMasterGardenerPrompt } from "../_shared/masterGardenerPrompt.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface GenerateImageRequest {
  contentContext: string;
  contentTitle?: string;
  channel: "newsletter" | "blog" | "instagram" | "facebook";
  uploadToStorage?: boolean;
  storageBucket?: string;
  userId?: string;
}

interface GenerateImageResponse {
  imageUrl: string;
  imageId: string;
  globalImageId?: string;
  metadata: {
    generationTime: number;
    prompt: string;
    storagePath?: string;
    channel: string;
    tags?: any[];
  };
}

interface GeneratedImageTag {
  name: string;
  category: string;
  confidence: number;
}

const TAG_GENERATION_TIMEOUT_MS = 30000;
const TAG_GENERATION_RETRY_DELAY_MS = 2000;
const TAG_GENERATION_MAX_RETRIES = 2;

// Active request deduplication cache
const activeRequests = new Map<string, Promise<any>>();

// Cache key generation for deduplication using the full prompt input.
function getCacheKey(contentContext: string, channel: string): string {
  const cacheInput = `${channel}\u0000${contentContext}`;
  let primaryHash = 0x811c9dc5;
  let secondaryHash = 0x9e3779b9;

  for (let index = 0; index < cacheInput.length; index++) {
    const codeUnit = cacheInput.charCodeAt(index);
    primaryHash ^= codeUnit;
    primaryHash = Math.imul(primaryHash, 16777619);
    secondaryHash ^= codeUnit;
    secondaryHash = Math.imul(secondaryHash, 2246822519);
  }

  return `img:${(primaryHash >>> 0).toString(16).padStart(8, "0")}${(secondaryHash >>> 0).toString(16).padStart(8, "0")}`;
}

function getErrorDetails(error: unknown) {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
    };
  }

  return {
    message: String(error),
    name: "UnknownError",
    stack: undefined,
  };
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function requestGeneratedTags(params: {
  authHeader: string;
  channel: GenerateImageRequest["channel"];
  contentContext: string;
  contentTitle: string;
  supabaseAnonKey: string;
  supabaseUrl: string;
}): Promise<GeneratedImageTag[]> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    TAG_GENERATION_TIMEOUT_MS,
  );

  try {
    const response = await fetch(
      `${params.supabaseUrl}/functions/v1/generate-image-tags`,
      {
        method: "POST",
        headers: {
          Authorization: params.authHeader,
          apikey: params.supabaseAnonKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          channel: params.channel,
          contentContext: params.contentContext,
          contentTitle: params.contentTitle,
        }),
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Tag generation request failed: ${response.status} - ${errorText.substring(0, 200)}`,
      );
    }

    const tagResponse = (await response.json()) as {
      error?: string;
      tags?: GeneratedImageTag[];
    };

    if (tagResponse.error) {
      throw new Error(tagResponse.error);
    }

    return tagResponse.tags || [];
  } finally {
    clearTimeout(timeout);
  }
}

async function generateAndStoreTagsWithRetry(params: {
  authHeader: string;
  channel: GenerateImageRequest["channel"];
  contentContext: string;
  contentTitle: string;
  globalImageId: string;
  supabase: SupabaseClient;
  supabaseAnonKey: string;
  supabaseUrl: string;
}) {
  for (let attempt = 0; attempt <= TAG_GENERATION_MAX_RETRIES; attempt++) {
    try {
      const generatedTags = await requestGeneratedTags({
        authHeader: params.authHeader,
        channel: params.channel,
        contentContext: params.contentContext,
        contentTitle: params.contentTitle,
        supabaseAnonKey: params.supabaseAnonKey,
        supabaseUrl: params.supabaseUrl,
      });

      if (generatedTags.length === 0) {
        console.warn(
          "⚠️ [Tag Generation] No tags returned after normalization",
          {
            contentContext: params.contentContext.substring(0, 200),
            globalImageId: params.globalImageId,
          },
        );
        return;
      }

      const tagInserts = generatedTags.map((tag) => ({
        image_id: params.globalImageId,
        tag_name: tag.name,
        tag_category: tag.category,
        confidence_score: tag.confidence,
        generated_by: "openai",
      }));

      const { error: tagsInsertError } = await params.supabase
        .from("global_image_tags")
        .upsert(tagInserts, {
          onConflict: "image_id,tag_name",
        });

      if (tagsInsertError) {
        throw tagsInsertError;
      }

      const { count, error: verifyError } = await params.supabase
        .from("global_image_tags")
        .select("id", { count: "exact", head: true })
        .eq("image_id", params.globalImageId);

      if (verifyError) {
        console.warn("⚠️ [Tag Generation] Tag verification query failed", {
          error: verifyError.message,
          globalImageId: params.globalImageId,
        });
      } else if (!count) {
        console.warn(
          "⚠️ [Tag Generation] Tag insert verification returned zero rows",
          {
            contentContext: params.contentContext.substring(0, 200),
            globalImageId: params.globalImageId,
          },
        );
      }

      return;
    } catch (error) {
      const errorDetails = getErrorDetails(error);

      if (attempt === TAG_GENERATION_MAX_RETRIES) {
        console.error("❌ [Tag Generation] Exhausted retries", {
          contentContext: params.contentContext.substring(0, 200),
          error: errorDetails.message,
          globalImageId: params.globalImageId,
        });
        return;
      }

      console.warn("⚠️ [Tag Generation] Retry scheduled", {
        attempt: attempt + 1,
        error: errorDetails.message,
        globalImageId: params.globalImageId,
      });
      await sleep(TAG_GENERATION_RETRY_DELAY_MS);
    }
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Set up abort signal with timeout (increased to 120s)
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    console.error("⏱️ Function timeout after 120 seconds");
    controller.abort();
  }, 120000); // 120 second timeout

  try {
    // SECURITY: [E24] - Add JWT authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization required" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAuthed = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const {
      data: { user: authenticatedUser },
      error: authError,
    } = await supabaseAuthed.auth.getUser();

    if (authError || !authenticatedUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const body: GenerateImageRequest = await req.json();
    const {
      contentContext: rawContentContext,
      contentTitle = "",
      channel = "newsletter",
      uploadToStorage = true,
      storageBucket = "campaign-images",
      userId = authenticatedUser.id,
    } = body;

    const resolvedUserId = authenticatedUser.id;

    if (userId && userId !== "anonymous" && userId !== resolvedUserId) {
      console.warn(
        "⚠️ Ignoring mismatched userId in generate-ai-image request body",
      );
    }

    // Location validation guard - block legacy profiles without confirmed location
    if (resolvedUserId) {
      const locationResult =
        await validateLocationForGeneration(resolvedUserId);
      if (!locationResult.isValid) {
        console.warn(
          `🚫 Image generation blocked for user ${resolvedUserId}: ${locationResult.error}`,
        );
        clearTimeout(timeout);
        return locationBlockedResponse();
      }
    }

    // Fetch company profile for climate constraints
    let climateConstraints = "";
    let tenantId: string | null = null;
    if (resolvedUserId) {
      const [{ data: userRecord }, { data: companyProfile }] =
        await Promise.all([
          supabaseAdmin
            .from("users")
            .select("tenant_id")
            .eq("id", resolvedUserId)
            .maybeSingle(),
          supabaseAdmin
            .from("company_profiles")
            .select(
              "climate_archetype, climate_label, postal_code, city, state_province, country, usda_zone",
            )
            .eq("user_id", resolvedUserId)
            .maybeSingle(),
        ]);

      tenantId = userRecord?.tenant_id || null;

      if (!tenantId) {
        throw new Error("User tenant not found for image generation");
      }

      if (companyProfile) {
        const climateProfile = extractClimateProfile(companyProfile);
        climateConstraints = buildImageClimateConstraints(climateProfile);
        console.log(
          "🌡️ Climate constraints loaded for image generation:",
          companyProfile.climate_archetype,
        );
      }
    }

    // Provide fallback for empty contentContext - use contentTitle or generic garden context
    const contentContext =
      rawContentContext && rawContentContext.trim()
        ? rawContentContext.trim()
        : contentTitle && contentTitle.trim()
          ? contentTitle.trim()
          : "Beautiful seasonal garden with vibrant plants and flowers for garden center marketing";

    console.log("🎨 [AI Image Generator] Starting generation:", {
      channel,
      contextLength: contentContext.length,
      title: contentTitle?.substring(0, 50),
      uploadToStorage,
    });

    // Check for duplicate request
    const cacheKey = getCacheKey(contentContext, channel);
    if (activeRequests.has(cacheKey)) {
      console.log(
        "🔄 Duplicate request detected, reusing in-progress generation",
      );
      try {
        const result = await activeRequests.get(cacheKey);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (error) {
        activeRequests.delete(cacheKey);
      }
    }

    // Generate enhanced prompt with climate constraints
    const imagePrompt = generateImagePrompt(
      contentContext,
      contentTitle,
      channel,
      climateConstraints,
    );
    console.log("📝 Generated prompt:", imagePrompt.substring(0, 200));

    // Create generation promise and cache it
    const generationPromise = (async () => {
      try {
        const startTime = Date.now();

        // Call AI with retry logic and timeout (60s allows for 2 retries with 18s each + backoff)
        const aiData = await Promise.race([
          generateWithRetry(imagePrompt, LOVABLE_API_KEY),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error("AI generation timeout after 60s")),
              60000,
            ),
          ),
        ]);

        const generationTime = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`⏱️ Image generated in ${generationTime}s`);

        // Extract base64 image
        const base64Image = extractBase64Image(aiData);
        if (!base64Image) {
          throw new Error("No image data in AI response");
        }

        console.log("✅ Received base64 image data", {
          sizeKB: Math.round(base64Image.length / 1024),
        });

        // Upload to CENTRAL storage ONLY
        let finalImageUrl = base64Image;
        let storagePath: string | undefined;
        let globalImageId: string | undefined;
        const generatedTags: GeneratedImageTag[] = [];

        if (uploadToStorage) {
          try {
            // Convert base64 to binary with memory optimization
            const base64Data = base64Image.replace(
              /^data:image\/\w+;base64,/,
              "",
            );
            let binaryData: Uint8Array;

            try {
              binaryData = Uint8Array.from(atob(base64Data), (c) =>
                c.charCodeAt(0),
              );
              console.log("✅ Base64 converted to binary:", {
                sizeKB: Math.round(binaryData.length / 1024),
                sizeMB: (binaryData.length / (1024 * 1024)).toFixed(2),
              });
            } catch (conversionError) {
              console.error("❌ Base64 conversion failed:", conversionError);
              throw new Error("Failed to convert base64 image data");
            }

            // Generate UUID-based filename for central storage
            const imageUuid = crypto.randomUUID();
            const filename = `${imageUuid}.png`;
            storagePath = `global/${filename}`;

            console.log("📤 Uploading to CENTRAL storage:", storagePath);

            // Upload to global-ai-images bucket
            const { error: uploadError } = await supabaseAdmin.storage
              .from("global-ai-images")
              .upload(storagePath, binaryData, {
                contentType: "image/png",
                upsert: false,
              });

            if (uploadError) {
              throw uploadError;
            }

            // Get public URL
            const {
              data: { publicUrl },
            } = supabaseAdmin.storage
              .from("global-ai-images")
              .getPublicUrl(storagePath);

            finalImageUrl = publicUrl;
            console.log("✅ Uploaded to CENTRAL storage successfully:", {
              uuid: imageUuid,
              bucket: "global-ai-images",
              path: storagePath,
              url: publicUrl,
              size_kb: Math.round(binaryData.length / 1024),
            });

            // Insert into global_image_gallery immediately
            const { data: imageRecord, error: insertError } =
              await supabaseAdmin
                .from("global_image_gallery")
                .insert({
                  created_by: resolvedUserId,
                  storage_path: storagePath,
                  storage_bucket: "global-ai-images",
                  public_url: finalImageUrl,
                  generation_prompt: imagePrompt,
                  content_context: contentContext,
                  content_title: contentTitle,
                  channel: channel,
                  file_size_bytes: binaryData.length,
                  mime_type: "image/png",
                  generation_model: "google/gemini-2.5-flash-image-preview",
                  tenant_id: tenantId,
                })
                .select("id")
                .single();

            if (insertError) {
              console.error(
                "❌ [Database] Failed to insert into global_image_gallery:",
                {
                  error: insertError.message,
                  code: insertError.code,
                  details: insertError.details,
                },
              );
            } else {
              const persistedGlobalImageId = imageRecord.id;
              globalImageId = persistedGlobalImageId;
              console.log(
                "✅ [Database] Image record created in global_image_gallery:",
                {
                  globalImageId,
                  storagePath,
                  channel,
                },
              );

              console.log(
                "🏷️ [Tag Generation] Starting background tag generation",
                {
                  globalImageId: persistedGlobalImageId,
                },
              );
              void generateAndStoreTagsWithRetry({
                authHeader,
                channel,
                contentContext,
                contentTitle,
                globalImageId: persistedGlobalImageId,
                supabase: supabaseAdmin,
                supabaseAnonKey,
                supabaseUrl,
              });

              // Final success summary
              console.log(
                "🎯 ═══════════════════════════════════════════════════",
              );
              console.log("🎯 CENTRALIZED STORAGE SUCCESS");
              console.log(
                "🎯 ═══════════════════════════════════════════════════",
              );
              console.log("🆔 Global Image ID:", globalImageId);
              console.log("📦 Storage Path:", storagePath);
              console.log("🔗 Public URL:", finalImageUrl);
              console.log("📺 Channel:", channel);
              console.log("🏷️ Tags: Generating in background");
              console.log("⏱️ Timestamp:", new Date().toISOString());
              console.log(
                "🎯 ═══════════════════════════════════════════════════",
              );
            }
          } catch (storageError: any) {
            console.error("❌ [CRITICAL] Central storage pipeline failed:", {
              error: storageError.message,
              stack: storageError.stack,
            });
            console.log("⚠️ Returning base64 image as fallback");
          }
        }

        return {
          imageUrl: finalImageUrl,
          imageId: crypto.randomUUID(),
          globalImageId: globalImageId,
          metadata: {
            generationTime: parseFloat(generationTime),
            prompt: contentTitle || "AI Generated",
            storagePath,
            channel,
            tags: generatedTags,
          },
        };
      } finally {
        setTimeout(() => activeRequests.delete(cacheKey), 60000);
      }
    })();

    activeRequests.set(cacheKey, generationPromise);
    const result = await generationPromise;

    clearTimeout(timeout);

    return new Response(JSON.stringify(result), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    clearTimeout(timeout);
    const errorDetails = getErrorDetails(error);
    console.error("❌ Error in generate-ai-image:", {
      message: errorDetails.message,
      name: errorDetails.name,
      stack: errorDetails.stack?.substring(0, 200),
    });

    const isTimeout =
      errorDetails.message.includes("timeout") ||
      errorDetails.name === "AbortError";
    const statusCode = isTimeout ? 408 : 500;

    return new Response(
      JSON.stringify({
        error: errorDetails.message || "Failed to generate image",
        type: isTimeout ? "timeout" : "error",
        retryable: true,
      }),
      {
        status: statusCode,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

async function generateWithRetry(
  prompt: string,
  apiKey: string,
  maxRetries = 3,
): Promise<any> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`🔄 AI generation attempt ${attempt + 1}/${maxRetries}`);

      const controller = new AbortController();
      const fetchTimeout = setTimeout(() => controller.abort(), 25000); // 25s timeout per attempt

      const response = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-image-preview",
            messages: [{ role: "user", content: prompt }],
            modalities: ["image", "text"],
          }),
          signal: controller.signal,
        },
      );

      clearTimeout(fetchTimeout);

      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get("retry-after") || "8");
        console.log(
          `⏳ Rate limited (429), waiting ${retryAfter}s before retry...`,
        );
        if (attempt < maxRetries - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, retryAfter * 1000),
          );
          continue;
        }
        throw new Error(
          `Rate limited after ${maxRetries} attempts. Please try again in a few seconds.`,
        );
      }

      if (response.status === 402) {
        throw new Error(
          "AI credits exhausted. Please add funds to continue generating images.",
        );
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `❌ AI Gateway returned ${response.status}:`,
          errorText.substring(0, 300),
        );
        throw new Error(
          `AI Gateway error: ${response.status} - ${errorText.substring(0, 200)}`,
        );
      }

      const jsonData = await response.json();

      // Validate response has image data before returning
      const hasImage =
        jsonData.choices?.[0]?.message?.images?.[0]?.image_url?.url ||
        jsonData.choices?.[0]?.message?.images?.[0]?.url ||
        (typeof jsonData.choices?.[0]?.message?.content === "string" &&
          jsonData.choices[0].message.content.startsWith("data:image")) ||
        jsonData.data?.[0]?.url ||
        jsonData.data?.[0]?.b64_json;

      if (!hasImage && attempt < maxRetries - 1) {
        console.log(
          `⚠️ AI response missing image data on attempt ${attempt + 1}, retrying...`,
        );
        console.log(
          "Response preview:",
          JSON.stringify(jsonData).substring(0, 500),
        );
        await new Promise((resolve) => setTimeout(resolve, 3000));
        continue;
      }

      return jsonData;
    } catch (error) {
      const errorDetails = getErrorDetails(error);
      console.error(`❌ Attempt ${attempt + 1} failed:`, errorDetails.message);
      if (attempt === maxRetries - 1) throw error;

      // Exponential backoff with jitter
      const backoffMs = 2000 * Math.pow(2, attempt) + Math.random() * 1000;
      console.log(`⏳ Retrying in ${Math.round(backoffMs)}ms...`);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }
  throw new Error("All retry attempts exhausted");
}

// Detect season from context or use current season
function detectSeasonFromContext(
  context: string,
  title: string,
): { season: string; monthName: string } {
  const combinedText = `${context} ${title}`.toLowerCase();

  // Check for explicit seasonal keywords
  const springKeywords = [
    "spring",
    "seed starting",
    "renewal",
    "awakening",
    "planting season",
    "april",
    "may",
    "march",
  ];
  const summerKeywords = [
    "summer",
    "heat",
    "watering",
    "harvest",
    "irrigation",
    "june",
    "july",
    "august",
  ];
  const fallKeywords = [
    "fall",
    "autumn",
    "cleanup",
    "winter prep",
    "bulbs",
    "thanksgiving",
    "halloween",
    "september",
    "october",
    "november",
  ];
  const winterKeywords = [
    "winter",
    "holiday",
    "christmas",
    "indoor",
    "houseplant",
    "new year",
    "gift",
    "december",
    "january",
    "february",
  ];

  if (springKeywords.some((keyword) => combinedText.includes(keyword))) {
    return { season: "spring", monthName: "Spring" };
  }
  if (summerKeywords.some((keyword) => combinedText.includes(keyword))) {
    return { season: "summer", monthName: "Summer" };
  }
  if (fallKeywords.some((keyword) => combinedText.includes(keyword))) {
    return { season: "fall", monthName: "Fall" };
  }
  if (winterKeywords.some((keyword) => combinedText.includes(keyword))) {
    return { season: "winter", monthName: "Winter" };
  }

  // No seasonal keywords found - use current season
  const now = new Date();
  const month = now.getMonth();

  if (month >= 2 && month <= 4) {
    return { season: "spring", monthName: "Spring" };
  } else if (month >= 5 && month <= 7) {
    return { season: "summer", monthName: "Summer" };
  } else if (month >= 8 && month <= 10) {
    return { season: "fall", monthName: "Fall" };
  } else {
    return { season: "winter", monthName: "Winter" };
  }
}

// Extract specific garden-related elements mentioned in context
function extractContextualElements(context: string, title: string): string[] {
  const combinedText = `${context} ${title}`.toLowerCase();
  const elements: string[] = [];

  // Tools
  const toolKeywords = [
    "shovel",
    "rake",
    "pruner",
    "pruners",
    "hose",
    "watering can",
    "gloves",
    "tool",
    "trowel",
    "spade",
  ];
  if (toolKeywords.some((keyword) => combinedText.includes(keyword))) {
    elements.push("tools");
  }

  // Products
  const productKeywords = [
    "fertilizer",
    "soil",
    "mulch",
    "seed",
    "pot",
    "planter",
    "container",
  ];
  if (productKeywords.some((keyword) => combinedText.includes(keyword))) {
    elements.push("products");
  }

  // Gifts
  const giftKeywords = ["gift", "present", "holiday gift", "gardener gift"];
  if (giftKeywords.some((keyword) => combinedText.includes(keyword))) {
    elements.push("gifts");
  }

  // Holiday/festive
  const holidayKeywords = ["christmas", "holiday", "festive", "celebration"];
  if (holidayKeywords.some((keyword) => combinedText.includes(keyword))) {
    elements.push("holiday");
  }

  return elements;
}

// Build seasonal descriptor for prompt
function buildSeasonalDescriptor(season: string): string {
  const descriptors: Record<string, string> = {
    spring:
      "Early spring blooms, fresh green growth, seed starting, awakening garden. Show cherry blossoms, tulips, daffodils, or fresh spring foliage with vibrant new growth.",
    summer:
      "Peak summer growth, vibrant blooms, lush greenery, full garden. Show roses, sunflowers, hydrangeas, or abundant summer vegetation with rich, saturated colors.",
    fall: "Autumn colors, fall foliage, harvest season, warm tones. Show mums, pumpkins, colorful leaves, or fall garden transitions with golden and russet hues.",
    winter:
      "Winter garden, evergreens, holiday elements, indoor plants. Show poinsettias, evergreen branches, winter berries, or festive holiday arrangements with natural winter beauty.",
  };

  return descriptors[season] || descriptors.winter;
}

// Build element-specific instructions
function buildElementInstructions(elements: string[]): string {
  const instructions: string[] = [];

  if (elements.includes("gifts") || elements.includes("holiday")) {
    instructions.push(
      "- Include gift-wrapped items or festive presentation among plants and garden elements",
    );
  }

  if (elements.includes("tools")) {
    instructions.push(
      "- Include garden tools (shovel, rake, pruners, trowel, etc.) placed naturally in the garden setting",
    );
  }

  if (elements.includes("products")) {
    instructions.push(
      "- Feature garden products (pots, soil bags, seed packets) integrated naturally with plants",
    );
  }

  return instructions.join("\n");
}

function generateImagePrompt(
  context: string,
  title: string,
  channel: string,
  climateConstraints: string = "",
): string {
  // Detect season from context or use current season
  const seasonInfo = detectSeasonFromContext(context, title);

  // Extract specific contextual elements (tools, gifts, plants, etc.)
  const contextualElements = extractContextualElements(context, title);

  // Build seasonal descriptor
  const seasonalDescriptor = buildSeasonalDescriptor(seasonInfo.season);

  // Build element-specific instructions
  const elementInstructions = buildElementInstructions(contextualElements);

  // Get Master Gardener expertise prompt for botanical accuracy
  const masterGardenerPrompt = getMasterGardenerPrompt();

  // Channel specifications
  const channelSpecs: Record<string, string> = {
    newsletter: "Professional, clean photography. Landscape 16:9.",
    instagram: "Vibrant, eye-catching square image. 1:1 aspect ratio.",
    facebook: "Engaging, shareable landscape format.",
    blog: "High-quality, informative landscape format.",
  };

  return `Create a high-quality, photorealistic image for garden marketing.

${masterGardenerPrompt}

${climateConstraints}

PRIMARY SUBJECTS (MUST INCLUDE):
- Gardens, plants, flowers, trees, or garden elements as the main focus
- Natural outdoor garden settings, greenhouse benches, nursery displays, or curated garden-center retail scenes where plants remain the focus
- Vibrant, healthy vegetation and natural beauty

CONTEXT: "${context}"
TITLE: "${title}"

SEASONAL CONTEXT:
${seasonalDescriptor}

${elementInstructions.length > 0 ? `SPECIFIC ELEMENTS TO INCLUDE:\n${elementInstructions}\n` : ""}
VISUAL REQUIREMENTS:
- Focus on plants first: gardens, flowers, trees, leaves, greenhouse benches, nursery tables, or tasteful retail displays with plants as the hero
- ${seasonInfo.season} seasonal characteristics and appropriate plants for this season
- Bright, natural lighting suitable for ${seasonInfo.season}
- Sharp focus on main subject
- Welcoming, inspiring garden atmosphere
- Professional photography quality

STYLE: ${channelSpecs[channel] || channelSpecs.newsletter}

CRITICAL RESTRICTIONS:
- DO NOT make building exteriors, empty storefronts, checkout counters, or commercial signage the main subject
- DO NOT include text overlays, logos, brand names, watermarks, or any written text

Generate an image that captures beautiful gardens and plants with ${seasonInfo.season} seasonal characteristics.`;
}

function extractBase64Image(aiData: any): string | null {
  try {
    // Log the full response structure for debugging
    console.log(
      "🔍 AI Response structure:",
      JSON.stringify({
        hasChoices: !!aiData.choices,
        choicesLength: aiData.choices?.length,
        hasMessage: !!aiData.choices?.[0]?.message,
        hasImages: !!aiData.choices?.[0]?.message?.images,
        imagesLength: aiData.choices?.[0]?.message?.images?.length,
        hasContent: !!aiData.choices?.[0]?.message?.content,
        contentType: typeof aiData.choices?.[0]?.message?.content,
        contentPreview:
          typeof aiData.choices?.[0]?.message?.content === "string"
            ? aiData.choices[0].message.content.substring(0, 100)
            : "not a string",
      }),
    );

    // Standard image response format
    if (aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url) {
      console.log("✅ Found image in standard images array format");
      return aiData.choices[0].message.images[0].image_url.url;
    }

    // Alternative: image directly in image_url
    if (aiData.choices?.[0]?.message?.images?.[0]?.url) {
      console.log("✅ Found image in images[0].url format");
      return aiData.choices[0].message.images[0].url;
    }

    // Content as base64 string
    if (aiData.choices?.[0]?.message?.content) {
      const content = aiData.choices[0].message.content;
      if (typeof content === "string" && content.startsWith("data:image")) {
        console.log("✅ Found image as base64 string in content");
        return content;
      }
      // Check if content is an array with image data
      if (Array.isArray(content)) {
        for (const item of content) {
          if (item.type === "image_url" && item.image_url?.url) {
            console.log("✅ Found image in content array");
            return item.image_url.url;
          }
          if (item.type === "image" && item.url) {
            console.log("✅ Found image in content array (image type)");
            return item.url;
          }
        }
      }
    }

    // Check for data field (some APIs return here)
    if (aiData.data?.[0]?.url) {
      console.log("✅ Found image in data[0].url format");
      return aiData.data[0].url;
    }
    if (aiData.data?.[0]?.b64_json) {
      console.log("✅ Found image as b64_json in data");
      return `data:image/png;base64,${aiData.data[0].b64_json}`;
    }

    console.error(
      "❌ No image found in any known format. Full response:",
      JSON.stringify(aiData).substring(0, 500),
    );
    return null;
  } catch (error) {
    console.error("Error extracting image:", error);
    return null;
  }
}
