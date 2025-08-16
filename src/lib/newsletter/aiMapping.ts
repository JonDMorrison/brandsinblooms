// Shared AI content mapping utilities for newsletter generation

export type AIResponse = {
  title?: string;
  content?: string;
  cta_text?: string;
  cta_url?: string;
  image_url?: string;
} | string;

export interface NormalizedAIResponse {
  title?: string;
  content?: string;
  cta_text?: string;
  cta_url?: string;
  image_url?: string;
}

/**
 * Normalizes AI response from edge function to consistent format
 */
export function normalizeAIResponse(response: AIResponse): NormalizedAIResponse {
  if (typeof response === 'string') {
    // Legacy fallback: treat as body content only
    return { 
      title: undefined, 
      content: response, 
      cta_text: undefined, 
      cta_url: undefined,
      image_url: undefined
    };
  }
  return response || {};
}

/**
 * Maps AI response fields to block properties using flexible field mapping
 */
export function applyAIToBlock(block: any, ai: NormalizedAIResponse): any {
  const updated = { ...block };

  // Title/headline mapping - try various field names
  const titleValue = ai.title ?? updated.title ?? updated.headline ?? updated.heading;
  if (titleValue) {
    if ('title' in updated) updated.title = titleValue;
    if ('headline' in updated) updated.headline = titleValue;
    if ('heading' in updated) updated.heading = titleValue;
  }

  // Body/content/description mapping
  const contentValue = ai.content ?? updated.body ?? updated.content ?? updated.description;
  if (contentValue) {
    if ('body' in updated) updated.body = contentValue;
    if ('content' in updated) updated.content = contentValue;
    if ('description' in updated) updated.description = contentValue;
  }

  // CTA text mapping
  const ctaTextValue = ai.cta_text ?? updated.ctaText ?? updated.buttonText ?? updated.cta_label;
  if (ctaTextValue) {
    if ('ctaText' in updated) updated.ctaText = ctaTextValue;
    if ('buttonText' in updated) updated.buttonText = ctaTextValue;
    if ('cta_label' in updated) updated.cta_label = ctaTextValue;
  }

  // CTA URL mapping
  const ctaUrlValue = ai.cta_url ?? updated.ctaUrl ?? updated.buttonUrl ?? updated.href;
  if (ctaUrlValue) {
    if ('ctaUrl' in updated) updated.ctaUrl = ctaUrlValue;
    if ('buttonUrl' in updated) updated.buttonUrl = ctaUrlValue;
    if ('href' in updated) updated.href = ctaUrlValue;
  }

  // Image URL mapping
  if (ai.image_url) {
    if ('image' in updated) {
      updated.image = { ...(updated.image || {}), url: ai.image_url };
    }
    if ('imageUrl' in updated) {
      updated.imageUrl = ai.image_url;
    }
  }

  return updated;
}