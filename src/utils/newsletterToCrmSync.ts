import {
  parseNewsletterYAML,
  StructuredNewsletter,
  extractNewsletterSections,
} from "./newsletterUtils";
import { processNewsletterContent } from "./newsletterContentProcessor";
import { ContentBlock, BlockType, BlockLayout } from "@/types/emailBuilder";
import yaml from "js-yaml";

export interface NewsletterToCRMConversion {
  campaignTitle: string;
  theme: string;
  readingTime: string;
  blocks: ContentBlock[];
  segments: string[];
  personaTags: string[];
  images: string[];
  originalContent: string;
}

// New standalone function for direct YAML to ContentBlock conversion
export function convertNewsletterToCRM_Direct(
  newsletterRaw: string,
): ContentBlock[] {
  const safeDecodeURIComponent = (value: string) => {
    try {
      return decodeURIComponent(value);
    } catch (error) {
      return value; // Return original value if decoding fails
    }
  };

  const decoded = safeDecodeURIComponent(newsletterRaw);
  let parsedBlocks: ContentBlock[] = [];

  // First try YAML parsing
  try {
    const parsed = yaml.load(decoded) as any;
    if (parsed && Array.isArray(parsed.blocks)) {
      // Create header block from newsletter_md first line
      if (parsed.newsletter_md) {
        const lines = parsed.newsletter_md.split("\n");
        const headlineLine = lines.find((line: string) => line.startsWith("#"));
        if (headlineLine) {
          parsedBlocks.push({
            id: "block-header",
            type: "header",
            headline: headlineLine.replace(/^#+\s*/, "").trim(),
            body: "Your weekly garden newsletter",
            alignment: "center",
            padding: "large",
            source: "newsletter",
            collapsed: false,
            visible: true,
            animation: "fade-in",
          });
        }
      }

      // Convert YAML blocks to ContentBlocks
      parsed.blocks.forEach((b: any, i: number) => {
        const hasImage =
          typeof b.image_url === "string" &&
          (/^https?:\/\//i.test(b.image_url) ||
            /^data:image\//i.test(b.image_url));
        const hasText = !!(b.title || b.body || b.content);

        // CRITICAL CHANGE: Force all content blocks to be image-text for weekly themes
        const blockType: BlockType = "image-text";

        parsedBlocks.push({
          id: `block-${i}`,
          type: blockType,
          title: b.title || "",
          headline: b.title || "", // For image-text blocks
          body: b.body || b.content || "", // For image-text blocks
          content: b.body || b.content || "", // For text blocks
          ctaText: b.cta || "",
          ctaUrl: b.link || "",
          imageUrl: hasImage ? b.image_url : undefined,
          altText: b.alt_text || "",
          alignment: "left",
          padding: "medium",
          source: "newsletter",
          collapsed: false,
          visible: true,
          animation: "fade-in",
          layout: "image-left" as BlockLayout,
        });
      });
      return parsedBlocks;
    }
  } catch (e) {}

  // Fallback: parse markdown into blocks
  const lines = decoded.split("\n");
  let current: ContentBlock | null = null;

  for (const line of lines) {
    if (line.startsWith("# ")) {
      // Header block
      if (current) parsedBlocks.push(current);
      current = {
        id: "block-header",
        type: "header",
        headline: line.replace("# ", "").trim(),
        body: "Your weekly garden newsletter",
        alignment: "center",
        padding: "large",
        source: "newsletter",
        collapsed: false,
        visible: true,
        animation: "fade-in",
      };
    } else if (line.startsWith("## ")) {
      // Text block title
      if (current) parsedBlocks.push(current);
      current = {
        id: `block-${parsedBlocks.length + 1}`,
        type: "image-text", // CHANGED: All content blocks must be image-text
        title: line.replace("## ", "").trim(),
        headline: line.replace("## ", "").trim(),
        content: "",
        body: "",
        imageUrl: "", // Will be generated
        alignment: "left",
        padding: "medium",
        source: "newsletter",
        collapsed: false,
        visible: true,
        animation: "fade-in",
        layout: "two-column-right",
      };
    } else if (current && line.trim()) {
      // Add content to current block
      current.content =
        (current.content || "") + (current.content ? "\n" : "") + line.trim();
      current.body = current.content; // Keep body in sync for image-text blocks
    }
  }

  if (current) parsedBlocks.push(current);

  return parsedBlocks;
}

export const convertNewsletterToCRM = (
  newsletterContent: string,
  campaignTitle?: string,
  contentTaskId?: string,
): NewsletterToCRMConversion => {
  // Try direct conversion first for better results
  const directBlocks = convertNewsletterToCRM_Direct(newsletterContent);
  if (directBlocks.length > 1) {
    return {
      campaignTitle: campaignTitle || "Newsletter Campaign",
      theme: "Garden Newsletter",
      readingTime: "3 min read",
      blocks: directBlocks,
      segments: ["newsletter-subscribers"],
      personaTags: ["general-gardener"],
      images: [],
      originalContent: newsletterContent,
    };
  }

  // Enhanced URL decode and YAML structure preprocessing
  let decodedContent = newsletterContent;
  const safeDecodeURIComponent = (value: string) => {
    try {
      return decodeURIComponent(value);
    } catch (error) {
      return value; // Return original value if decoding fails
    }
  };

  try {
    if (newsletterContent.includes("%")) {
      decodedContent = safeDecodeURIComponent(newsletterContent);

      // Comprehensive YAML structure fixes
      decodedContent = decodedContent
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "\r")
        .replace(/\+/g, " ")
        // Critical fix: Handle newsletter_md pipe syntax with inline content
        .replace(
          /newsletter_md:\s*\|\s*(.+?)(\s+##|\s+blocks:|\s+meta:|\s+extra_content_ideas:|$)/gs,
          (match, content, ending) => {
            // Split content and ensure proper indentation
            const lines = content.split(/(?=\s*##\s+)/g);
            const indentedContent = lines
              .map((line) => line.trim())
              .filter((line) => line)
              .map((line) => `  ${line}`)
              .join("\n");

            return `newsletter_md: |\n${indentedContent}${ending ? "\n" + ending.trim() : ""}`;
          },
        )
        // Fix blocks section structure
        .replace(/(\w)\s+(blocks:|meta:|extra_content_ideas:)/g, "$1\n\n$2")
        // Handle inline blocks that may be malformed
        .replace(/blocks:\s*-\s*title:/g, "blocks:\n  - title:")
        // Fix block field spacing
        .replace(/(\w+):\s*"([^"]*?)"\s*(\w+):/g, '$1: "$2"\n    $3:')
        // Ensure proper line breaks between major sections
        .replace(/(\w)\s*(newsletter_md:|blocks:|meta:)/g, "$1\n\n$2");
    }
  } catch (error) {}

  // First try to parse as YAML with pipe syntax
  const parsedNewsletter = parseNewsletterYAML(decodedContent);

  let processedNewsletter;
  if (parsedNewsletter) {
    processedNewsletter = {
      newsletter_md: parsedNewsletter.newsletter_md,
      blocks: parsedNewsletter.blocks,
      meta: parsedNewsletter.meta,
      isStructured: true,
      needsRegeneration: false,
    };
  } else {
    // Fallback to regular processing
    processedNewsletter = processNewsletterContent(
      decodedContent,
      campaignTitle,
    );

    // If unstructured, convert unstructuredSections to blocks format
    if (
      !processedNewsletter.isStructured &&
      processedNewsletter.unstructuredSections
    ) {
      processedNewsletter.blocks = processedNewsletter.unstructuredSections.map(
        (section, index) => ({
          title: section.title || `Section ${index + 1}`,
          body: section.content || "",
          cta: section.cta || "Learn More",
          link: section.link || "#",
          image_prompt:
            section.image_prompt ||
            `${section.title || campaignTitle} garden newsletter`,
          alt_text:
            section.alt_text || `Image for ${section.title || campaignTitle}`,
        }),
      );
    }
  }

  // Extract persona tags and segments with safe null handling
  const personaTags = extractPersonaTags(newsletterContent);
  const safeTheme = processedNewsletter.meta?.theme || "Garden Newsletter";
  const segments = generateSegmentSuggestions(
    newsletterContent,
    safeTheme,
    personaTags,
  );
  const images = extractImageUrls(newsletterContent);

  // Convert newsletter blocks directly to ContentBlocks
  const contentBlocks: ContentBlock[] = [];

  // Parse the markdown content to extract headline and subheadline
  const markdownLines = processedNewsletter.newsletter_md?.split("\n") || [];
  const headlineLine = markdownLines.find((line) => line.startsWith("#"));
  const subheadlineLine = markdownLines.find(
    (line) => line.startsWith("*") && line.endsWith("*"),
  );

  // Create header block with headline and subheadline
  if (headlineLine) {
    const headline = headlineLine.replace(/^#+\s*/, "").trim();
    const subheadline = subheadlineLine
      ? subheadlineLine.replace(/^\*|\*$/g, "").trim()
      : "";

    contentBlocks.push({
      id: `header-${Date.now()}`,
      type: "header",
      headline,
      body: subheadline || "Your weekly garden newsletter",
      alignment: "center",
      padding: "large",
      source: "newsletter",
      collapsed: false,
      visible: true,
      animation: "fade-in",
    });
  }

  // Convert newsletter blocks to ContentBlocks
  if (processedNewsletter.blocks && processedNewsletter.blocks.length > 0) {
    processedNewsletter.blocks.forEach((block, index) => {
      const hasImage =
        typeof block.image_url === "string" &&
        (/^https?:\/\//i.test(block.image_url) ||
          /^data:image\//i.test(block.image_url));
      const hasText = !!(block.title || block.body);

      // CRITICAL CHANGE: Force all content blocks to be image-text for weekly themes
      const blockType: BlockType = "image-text";
      const blockLayout: BlockLayout =
        hasImage && hasText ? "image-right" : "two-column-right";

      const contentBlock: ContentBlock = {
        id: `content-${Date.now()}-${index}`,
        type: blockType,
        title: block.title,
        headline: block.title, // For image-text blocks
        body: block.body, // For image-text blocks
        content: block.body, // For text blocks
        imageUrl: hasImage ? block.image_url : undefined,
        altText: block.alt_text,
        alignment: "left",
        padding: "medium",
        source: "newsletter",
        collapsed: false,
        visible: true,
        animation: "fade-in",
        layout: blockLayout,
      };
      contentBlocks.push(contentBlock);
    });
  } else {
    // Enhanced fallback: Try to extract from newsletter_md content
    if (processedNewsletter.newsletter_md) {
      const { sections } = extractNewsletterSections(
        processedNewsletter.newsletter_md,
      );

      sections.forEach((section, index) => {
        contentBlocks.push({
          id: `section-${Date.now()}-${index}`,
          type: "image-text" as const,
          title: section.title,
          content: section.content,
          alignment: "left" as const,
          padding: "medium" as const,
          source: "newsletter" as const,
          collapsed: false,
          visible: true,
          animation: "fade-in" as const,
          layout: "two-column-right" as const,
        });
      });
    }

    // Aggressive fallback: Split the entire content by ## headers if markdown extraction failed
    if (contentBlocks.length === 1) {
      // Only header exists

      // Split by ## pattern
      const headerSections = decodedContent.split(/##\s+/);
      if (headerSections.length > 1) {
        headerSections.slice(1).forEach((section, index) => {
          const lines = section.split("\n");
          const title = lines[0]?.trim() || `Section ${index + 1}`;
          const content = lines.slice(1).join("\n").trim();

          if (content) {
            contentBlocks.push({
              id: `split-${Date.now()}-${index}`,
              type: "image-text" as const,
              title: title,
              content: content.substring(0, 1000), // Limit content length
              alignment: "left" as const,
              padding: "medium" as const,
              source: "newsletter" as const,
              collapsed: false,
              visible: true,
              animation: "fade-in" as const,
              layout: "two-column-right" as const,
            });
          }
        });
      }
    }

    // Last resort fallback
    if (contentBlocks.length === 1) {
      // Only header exists
      contentBlocks.push({
        id: `fallback-${Date.now()}`,
        type: "image-text" as const,
        title: "Newsletter Content",
        content:
          decodedContent.substring(0, 1000) +
          (decodedContent.length > 1000 ? "..." : ""),
        alignment: "left" as const,
        padding: "medium" as const,
        source: "newsletter" as const,
        collapsed: false,
        visible: true,
        animation: "fade-in" as const,
        layout: "two-column-right" as const,
      });
    }
  }

  // Final validation
  return {
    campaignTitle:
      campaignTitle ||
      processedNewsletter.meta?.week_focus ||
      "Newsletter Campaign",
    theme: processedNewsletter.meta?.theme || "Garden Newsletter",
    readingTime: processedNewsletter.meta?.reading_time || "3 min read",
    blocks: contentBlocks,
    segments,
    personaTags,
    images,
    originalContent: newsletterContent,
  };
};

// Extract persona tags from content
const extractPersonaTags = (content: string): string[] => {
  const tags: string[] = [];
  const lowerContent = content.toLowerCase();

  // Analyze content for persona indicators
  if (
    lowerContent.includes("beginner") ||
    lowerContent.includes("new to gardening")
  ) {
    tags.push("gardening-beginner");
  }
  if (lowerContent.includes("expert") || lowerContent.includes("experienced")) {
    tags.push("gardening-expert");
  }
  if (lowerContent.includes("organic") || lowerContent.includes("natural")) {
    tags.push("organic-enthusiast");
  }
  if (lowerContent.includes("indoor") || lowerContent.includes("houseplant")) {
    tags.push("indoor-gardener");
  }
  if (lowerContent.includes("vegetable") || lowerContent.includes("herbs")) {
    tags.push("food-gardener");
  }
  if (lowerContent.includes("flower") || lowerContent.includes("ornamental")) {
    tags.push("ornamental-gardener");
  }
  if (lowerContent.includes("seasonal") || lowerContent.includes("planning")) {
    tags.push("seasonal-planner");
  }

  return tags.length > 0 ? tags : ["general-gardener"];
};

// Generate segment suggestions based on content
const generateSegmentSuggestions = (
  content: string,
  theme: string,
  personaTags: string[],
): string[] => {
  const segments: string[] = [];

  // Base segments
  segments.push("newsletter-subscribers");

  // Theme-based segments with safe null handling
  const safeTheme = (theme || "").toLowerCase();
  if (safeTheme.includes("summer")) {
    segments.push("summer-gardening-interested");
  }
  if (safeTheme.includes("seasonal")) {
    segments.push("seasonal-gardening-tips");
  }

  // Persona-based segments
  if (personaTags.includes("gardening-beginner")) {
    segments.push("beginner-gardeners");
  }
  if (personaTags.includes("organic-enthusiast")) {
    segments.push("organic-gardening-customers");
  }
  if (personaTags.includes("food-gardener")) {
    segments.push("vegetable-herb-growers");
  }

  // Engagement-based segments
  segments.push("highly-engaged-customers");
  segments.push("newsletter-active-readers");

  return segments;
};

// Extract image URLs from content
const extractImageUrls = (content: string): string[] => {
  const imageUrls: string[] = [];
  const imageRegex = /https?:\/\/[^\s]+\.(?:jpg|jpeg|png|gif|webp)/gi;
  const matches = content.match(imageRegex);

  if (matches) {
    imageUrls.push(...matches);
  }

  return imageUrls;
};

// Create CRM campaign data structure
export const createCRMCampaignFromNewsletter = (
  conversion: NewsletterToCRMConversion,
  scheduleData?: {
    sendDate?: Date;
    sendTime?: string;
  },
) => {
  return {
    name: conversion.campaignTitle,
    subject: conversion.campaignTitle,
    preheader: `${conversion.readingTime} read - ${conversion.theme}`,
    content: conversion.blocks,
    segments: conversion.segments,
    metadata: {
      source: "newsletter-conversion",
      theme: conversion.theme,
      readingTime: conversion.readingTime,
      personaTags: conversion.personaTags,
      originalContentLength: conversion.originalContent.length,
    },
    schedule: scheduleData || {
      type: "draft",
    },
  };
};
