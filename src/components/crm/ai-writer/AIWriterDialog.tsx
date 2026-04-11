import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles } from "lucide-react";
import { usePersonaAwareGeneration } from "@/hooks/usePersonaAwareGeneration";
import { generateNewsletterBlocks } from "@/services/newsletterBlockGenerator";
import { imageGenerationService } from "@/services/imageGenerationService";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ContentBlock } from "@/types/emailBuilder";

interface AIWriterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContentGenerated: (data: {
    campaignName: string;
    subjectLine: string;
    preheaderText: string;
    blocks: ContentBlock[];
  }) => void;
  onBlockImageGenerated?: (blockId: string, imageUrl: string) => void;
  onBlockImageGenerationFailed?: (blockId: string, error: string) => void;
}

export const AIWriterDialog: React.FC<AIWriterDialogProps> = ({
  open,
  onOpenChange,
  onContentGenerated,
  onBlockImageGenerated,
  onBlockImageGenerationFailed,
}) => {
  const [topic, setTopic] = useState("");
  const [layout, setLayout] = useState<"block-builder" | "simple-email">(
    "block-builder",
  );
  const [tone, setTone] = useState("professional");
  const [customInstructions, setCustomInstructions] = useState("");
  const [generating, setGenerating] = useState(false);
  const [usedImageIds, setUsedImageIds] = useState<Set<string>>(new Set());
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [imageGenerationProgress, setImageGenerationProgress] = useState({
    completed: 0,
    total: 0,
  });

  const { selectedPersonas, generateEmailContent } =
    usePersonaAwareGeneration();
  const { toast } = useToast();

  const handleGenerate = async () => {
    if (!topic.trim()) {
      toast({
        title: "Missing Topic",
        description: "Please enter a topic for your newsletter.",
        variant: "destructive",
      });
      return;
    }

    setGenerating(true);

    try {
      // Step 1: Generate basic newsletter structure
      const baseBlocks = generateNewsletterBlocks({
        topic: topic,
        layout: layout,
        templateBlocks: [],
      });

      if (baseBlocks.length === 0) {
        throw new Error("Failed to generate base newsletter structure");
      }

      // Step 2: Enhance content with AI for each block using edge function
      const enhancedBlocks: ContentBlock[] = [];
      // Track used images locally (synchronous) to avoid async state timing issues
      const localUsedImageIds = new Set<string>(usedImageIds);

      for (let i = 0; i < baseBlocks.length; i++) {
        const block = baseBlocks[i];
        if (block.type === "header" || block.type === "divider") {
          // CRITICAL FIX: Mark header blocks for image generation
          if (block.type === "header") {
            enhancedBlocks.push({
              ...block,
              isGeneratingImage: true,
              backgroundImageUrl: undefined,
            });
          } else {
            // Keep divider blocks as-is
            enhancedBlocks.push(block);
          }
          continue;
        }

        try {
          // Build proper prompt and call edge function
          const blockPrompt = createBlockPrompt(
            block,
            topic.trim(),
            tone,
            customInstructions.trim(),
            i,
          );
          const payload = {
            prompt: blockPrompt,
            type: "email_block",
            postType: "newsletter",
          };
          const { data, error } = await supabase.functions.invoke(
            "generate-email-content",
            {
              body: payload,
            },
          );
          if (error) {
            enhancedBlocks.push(block);
            continue;
          }

          // Use structured mapping instead of parsing
          const { normalizeAIResponse, applyAIToBlock } =
            await import("@/lib/newsletter/aiMapping");
          const normalizedAI = normalizeAIResponse(data);
          const enhancedBlock = applyAIToBlock(block, normalizedAI);

          // CRITICAL: Enforce image-left layout for weekly theme content blocks
          // Headers and dividers are already handled above
          if (block.type !== "newsletter-header" && block.type !== "button") {
            enhancedBlock.layout = "image-left";
            enhancedBlock.isGeneratingImage = true;
            enhancedBlock.imageUrl = undefined;
            enhancedBlock.shouldFetchImage = true;
            enhancedBlock.isWeeklyTheme = true;
          }

          enhancedBlocks.push(enhancedBlock);
        } catch (error) {
          enhancedBlocks.push(block);
        }
      }

      // Sync local image tracking to state for next dialog open
      setUsedImageIds(localUsedImageIds);

      // Step 4: Generate subject line and preheader
      const subjectLine = generateSubjectLine(topic, tone);
      const preheaderText = generatePreheaderText(topic, tone);

      // Step 4: Return content immediately (no waiting for images)
      onContentGenerated({
        campaignName: topic,
        subjectLine: subjectLine,
        preheaderText: preheaderText,
        blocks: enhancedBlocks,
      });

      onOpenChange(false);

      toast({
        title: "Newsletter Generated!",
        description: `Created ${enhancedBlocks.length} blocks. Generating images with AI...`,
      });

      // Step 5: Generate images in parallel (background)
      startParallelImageGeneration(enhancedBlocks);
    } catch (error: any) {
      console.error("Failed to generate newsletter:", error);
      toast({
        title: "Generation Failed",
        description:
          error.message ||
          "Failed to generate newsletter content. Please try again.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const startParallelImageGeneration = async (blocks: ContentBlock[]) => {
    // OPTION A IMPLEMENTED: Header blocks ARE allowed to have auto-generated images
    // Include header blocks that need images (backgroundImageUrl is empty)
    const imageBlocks = blocks.filter((block) => {
      // Never generate for button/divider
      if (block.type === "button" || block.type === "divider") {
        return false;
      }

      // For header blocks, check if they need a background image
      if (block.type === "header" || block.type === "newsletter-header") {
        const needsImage = block.isGeneratingImage || !block.backgroundImageUrl;
        return needsImage;
      }

      // For other blocks, check normal image generation conditions
      return (
        block.isGeneratingImage ||
        block.shouldFetchImage ||
        block.layout === "image-left"
      );
    });

    if (imageBlocks.length === 0) {
      return;
    }
    // Set loading state
    setIsGeneratingImages(true);
    setImageGenerationProgress({ completed: 0, total: imageBlocks.length });

    let succeeded = 0;
    let failed = 0;

    // Generate all images in parallel WITHOUT waiting for all to complete
    // Each image will notify parent as soon as it's ready
    imageBlocks.forEach(async (block, index) => {
      try {
        const isHeaderBlock =
          block.type === "header" || block.type === "newsletter-header";
        const contentContext = (block.body || block.content || topic).trim();
        const contentTitle = (block.headline || block.title || topic).trim();

        const { data, error } = await supabase.functions.invoke(
          "generate-ai-image",
          {
            body: {
              contentContext,
              contentTitle,
              channel: "newsletter",
              uploadToStorage: true,
            },
          },
        );

        if (error) throw error;
        succeeded++;

        // Update progress
        setImageGenerationProgress((prev) => ({
          ...prev,
          completed: prev.completed + 1,
        }));

        // Notify parent component immediately as soon as image is ready
        // Parent must handle header vs non-header image field assignment
        if (onBlockImageGenerated && data?.imageUrl) {
          onBlockImageGenerated(block.id, data.imageUrl);
        }

        // Check if all images completed
        if (succeeded + failed === imageBlocks.length) {
          setIsGeneratingImages(false);
          toast({
            title: "Images Generated",
            description: `Successfully generated ${succeeded}/${imageBlocks.length} AI images`,
          });
        }
      } catch (error: any) {
        console.error(
          `❌ Failed to generate image for block ${block.id}:`,
          error,
        );
        failed++;

        // Update progress
        setImageGenerationProgress((prev) => ({
          ...prev,
          completed: prev.completed + 1,
        }));

        // Notify parent component of failure and clear the generating flag
        if (onBlockImageGenerationFailed) {
          onBlockImageGenerationFailed(
            block.id,
            error.message || "Image generation failed",
          );
        }

        // CRITICAL: Also call onBlockImageGenerated with empty URL to clear loading state
        if (onBlockImageGenerated) {
          onBlockImageGenerated(block.id, "");
        }

        // Check if all images completed
        if (succeeded + failed === imageBlocks.length) {
          setIsGeneratingImages(false);
          toast({
            title: "Image Generation Complete",
            description: `Generated ${succeeded}/${imageBlocks.length} images. ${failed > 0 ? `${failed} failed.` : ""}`,
            variant: failed > 0 ? "destructive" : "default",
          });
        }
      }
    });

    // Show initial toast immediately
    toast({
      title: "Generating AI Images",
      description: `Generating ${imageBlocks.length} images in background. They'll appear as ready.`,
    });

    // CRITICAL: Add timeout safety to clear generating flags after 30 seconds
    setTimeout(() => {
      imageBlocks.forEach((block) => {
        // If callback exists, clear the generating flag for any blocks still generating
        if (onBlockImageGenerated) {
          onBlockImageGenerated(block.id, "");
        }
      });
    }, 30000);
  };

  const reset = () => {
    setTopic("");
    setLayout("block-builder");
    setTone("professional");
    setCustomInstructions("");
    setUsedImageIds(new Set());
  };

  const handleClose = (open: boolean) => {
    if (!generating) {
      if (!open) reset();
      onOpenChange(open);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Write with AI
          </DialogTitle>
        </DialogHeader>

        {/* AI Image Generation Loading Overlay */}
        {isGeneratingImages && (
          <div className="absolute inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center rounded-lg">
            <div className="max-w-md w-full mx-4">
              <div className="bg-card rounded-lg border p-6">
                <div className="flex flex-col items-center gap-4">
                  <div className="relative">
                    <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary border-t-transparent" />
                    <Sparkles className="absolute inset-0 m-auto h-8 w-8 text-primary animate-pulse" />
                  </div>

                  <div className="text-center space-y-2">
                    <h3 className="text-lg font-semibold">Generating Images</h3>
                    <p className="text-sm text-muted-foreground">
                      Creating AI-generated images for your content blocks
                    </p>
                    <p className="text-xs text-muted-foreground">
                      This may take 8-12 seconds per image
                    </p>
                  </div>

                  {imageGenerationProgress.total > 0 && (
                    <div className="w-full space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Progress</span>
                        <span className="font-medium">
                          {imageGenerationProgress.completed} /{" "}
                          {imageGenerationProgress.total}
                        </span>
                      </div>
                      <div className="w-full bg-gray-300 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-primary h-full transition-all duration-500 ease-out"
                          style={{
                            width: `${(imageGenerationProgress.completed / imageGenerationProgress.total) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <Label htmlFor="topic">Newsletter Topic *</Label>
            <Input
              id="topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., Spring Gardening Tips"
              disabled={generating}
            />
          </div>

          <div>
            <Label htmlFor="layout">Layout Style</Label>
            <NativeSelect
              value={layout}
              onChange={(e) =>
                setLayout(e.target.value as "block-builder" | "simple-email")
              }
              disabled={generating}
            >
              <option value="block-builder">
                Rich Layout (Multiple sections with images)
              </option>
              <option value="simple-email">Simple Layout (Text-focused)</option>
            </NativeSelect>
          </div>

          <div>
            <Label htmlFor="tone">Writing Tone</Label>
            <NativeSelect
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              disabled={generating}
            >
              <option value="professional">Professional</option>
              <option value="friendly">Friendly</option>
              <option value="expert">Expert</option>
              <option value="casual">Casual</option>
              <option value="educational">Educational</option>
            </NativeSelect>
          </div>

          <div>
            <Label htmlFor="instructions">
              Additional Instructions (Optional)
            </Label>
            <Textarea
              id="instructions"
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder="Any specific requirements or focus areas..."
              className="h-20"
              disabled={generating}
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleGenerate}
              disabled={generating || !topic.trim()}
              className="flex-1"
            >
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Newsletter
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={generating}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Helper functions
const createBlockPrompt = (
  block: ContentBlock,
  topic: string,
  tone: string,
  customInstructions: string,
  blockIndex: number,
): string => {
  const toneInstructions = {
    professional:
      "Use a professional, authoritative tone that builds trust and credibility.",
    friendly:
      "Use a warm, approachable tone that feels like advice from a knowledgeable friend.",
    expert:
      "Use an expert tone with technical details and industry-specific knowledge.",
    casual:
      "Use a conversational, relaxed tone that is easy to read and engaging.",
    educational:
      "Use an instructional tone that teaches and guides readers step-by-step.",
  };

  // Map block positions to newsletter sections
  const sectionMapping = {
    0: "Featured Story",
    1: "Main Article",
    2: "Secondary Feature",
    3: "Call to Action",
  };

  const sectionName = sectionMapping[blockIndex] || `Section ${blockIndex + 1}`;

  const sectionInstructions = {
    "Featured Story": {
      headline:
        "Create an attention-grabbing headline that highlights the most important aspect of this topic",
      body: "Write 4-5 sentences that introduce the topic, explain why it's important now, and give readers a preview of what they'll learn. Make it engaging and informative.",
      length: "100-150 words",
    },
    "Main Article": {
      headline: "Create an informative headline that promises practical value",
      body: "Write detailed content with 6-8 sentences covering key techniques, best practices, and actionable advice. Include specific tips that garden center customers can immediately apply.",
      length: "150-200 words",
    },
    "Secondary Feature": {
      headline:
        "Create a compelling headline for a supporting topic or related tip",
      body: "Write 3-4 sentences that complement the main article with additional insights, related products, or seasonal considerations.",
      length: "80-120 words",
    },
    "Call to Action": {
      headline: "Create an action-oriented headline that motivates engagement",
      body: "Write 2-3 sentences that encourage readers to take a specific action, whether visiting the garden center, trying a technique, or learning more.",
      length: "50-80 words",
    },
  };

  const section =
    sectionInstructions[sectionName] || sectionInstructions["Featured Story"];

  return `You are writing the "${sectionName}" section for a professional garden center newsletter about "${topic}".

SECTION REQUIREMENTS:
- ${section.headline}
- ${section.body}
- Target length: ${section.length}
- Make content specific to ${topic} with practical, actionable advice
- Include relevant seasonal timing, care instructions, or product recommendations
- Write for garden center customers (both beginners and experienced gardeners)

TONE: ${toneInstructions[tone] || toneInstructions.professional}

${customInstructions ? `ADDITIONAL REQUIREMENTS: ${customInstructions}` : ""}

CRITICAL: Return ONLY a valid JSON object with this exact format:
{
  "headline": "Specific headline about ${topic}",
  "body": "Detailed, informative content about ${topic} (${section.length})",
  "ctaText": "${sectionName === "Call to Action" ? "Visit Our Garden Center" : ""}",
  "ctaUrl": "${sectionName === "Call to Action" ? "#" : ""}"
}

Make sure the content is rich, specific, and valuable - not generic gardening advice.`;
};

const parseAIContent = (content: string, blockType: string) => {
  try {
    // Clean the content and try to extract JSON
    let cleanContent = content.trim();

    // Remove any markdown code blocks
    cleanContent = cleanContent
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "");

    // Find JSON object in the response
    const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        headline: parsed.headline || parsed.title || "",
        body: parsed.body || parsed.content || "",
        ctaText: parsed.ctaText || parsed.cta_text || parsed.buttonText || "",
        ctaUrl: parsed.ctaUrl || parsed.cta_url || parsed.buttonUrl || "#",
      };
    }

    throw new Error("No JSON found");
  } catch (error) {
    // More robust fallback parsing
    const lines = content.split("\n").filter((line) => line.trim());
    const headline =
      lines.find(
        (line) =>
          line.includes("headline") ||
          line.includes("title") ||
          (!line.includes(":") && line.length > 10 && line.length < 100),
      ) ||
      lines[0] ||
      "";

    const bodyLines = lines.filter(
      (line) =>
        !line.includes("headline") &&
        !line.includes("title") &&
        line.length > 20,
    );

    return {
      headline: headline
        .replace(/["'{}:]/g, "")
        .replace(/headline|title/g, "")
        .trim(),
      body:
        bodyLines
          .join(" ")
          .replace(/["'{}:]/g, "")
          .trim() || content,
      ctaText: blockType === "button" ? "Learn More" : "",
      ctaUrl: "#",
    };
  }
};

const createImageKeywords = (topic: string, blockIndex: number): string => {
  // Create specific image search terms based on the topic and section
  const topicKeywords = topic.toLowerCase();

  // Force hydrangea-specific keywords if topic contains hydrangea
  if (topicKeywords.includes("hydrangea")) {
    const hydrangeaSectionKeywords = {
      0: "hydrangea featured summer garden", // Featured Story
      1: "hydrangea care tips pruning", // Main Article
      2: "hydrangea garden center display varieties", // Secondary Feature
      3: "hydrangea healthy plants blooming", // Call to Action
    };
    return hydrangeaSectionKeywords[blockIndex] || "hydrangea summer garden";
  }

  const sectionKeywords = {
    0: "featured beautiful", // Featured Story
    1: "care growing tips", // Main Article
    2: "garden center display", // Secondary Feature
    3: "healthy plants garden", // Call to Action
  };

  const sectionModifier = sectionKeywords[blockIndex] || "gardening";
  return `${topicKeywords} ${sectionModifier}`;
};

const generateSubjectLine = (topic: string, tone: string): string => {
  const toneVariants = {
    professional: [
      `${topic} - Expert Insights`,
      `Professional Guide: ${topic}`,
    ],
    friendly: [`Your ${topic} Guide is Here!`, `Let's Talk ${topic} 🌱`],
    expert: [`Advanced ${topic} Techniques`, `Master ${topic} with These Tips`],
    casual: [`${topic} Made Easy`, `Quick ${topic} Tips Inside`],
    educational: [`Learn ${topic} - Step by Step`, `${topic} Tutorial & Tips`],
  };

  const variants = toneVariants[tone] || toneVariants.professional;
  return variants[Math.floor(Math.random() * variants.length)];
};

const generatePreheaderText = (topic: string, tone: string): string => {
  const preheaders = [
    `Essential tips and insights for ${topic.toLowerCase()}`,
    `Everything you need to know about ${topic.toLowerCase()}`,
    `Professional advice for successful ${topic.toLowerCase()}`,
    `Expert guidance for ${topic.toLowerCase()} success`,
  ];

  return preheaders[Math.floor(Math.random() * preheaders.length)];
};

// Quality validation function
const validateContentQuality = (content: any, topic: string): boolean => {
  const { headline, body } = content;

  // Check minimum length requirements
  if (!headline || headline.length < 10 || !body || body.length < 50) {
    return false;
  }

  // Check for generic phrases that should be avoided
  const genericPhrases = [
    "latest updates and insights",
    "this week's newsletter",
    "welcome to this week",
    "share your expertise",
    "tips or latest news",
    "your main content area",
    "keep it engaging",
    "valuable for your readers",
    "thank you for reading",
    "continued support",
    "take action now",
    "discover what we have",
  ];

  const combinedText = (headline + " " + body).toLowerCase();
  const hasGenericContent = genericPhrases.some((phrase) =>
    combinedText.includes(phrase.toLowerCase()),
  );

  if (hasGenericContent) {
    return false;
  }

  // Check if content mentions the topic
  const topicKeywords = topic.toLowerCase().split(" ");
  const mentionsTopic = topicKeywords.some((keyword) =>
    combinedText.includes(keyword.toLowerCase()),
  );

  return mentionsTopic;
};

// Retry prompt with more specific instructions
const createRetryPrompt = (
  block: ContentBlock,
  topic: string,
  tone: string,
  customInstructions: string,
  blockIndex: number,
): string => {
  const basePrompt = createBlockPrompt(
    block,
    topic,
    tone,
    customInstructions,
    blockIndex,
  );

  return (
    basePrompt +
    `

CRITICAL RETRY REQUIREMENTS:
- DO NOT use generic newsletter language like "latest updates", "this week's newsletter", or "welcome to"
- MUST mention "${topic}" specifically in both headline and body content
- Provide SPECIFIC, ACTIONABLE information about ${topic}
- Include concrete tips, techniques, or advice related to ${topic}
- Write content that garden center customers would find immediately useful
- Be specific about timing, care instructions, or product recommendations for ${topic}

This is a retry - the previous content was too generic. Make it much more specific and valuable.`
  );
};
