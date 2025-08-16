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
  console.log('[AI Mapping] Raw response:', response);
  
  if (typeof response === 'string') {
    // Check if the string contains JSON (possibly wrapped in markdown code fences)
    const jsonMatch = response.match(/```json\s*(\{[\s\S]*?\})\s*```/) || 
                     response.match(/```\s*(\{[\s\S]*?\})\s*```/) ||
                     response.match(/(\{[\s\S]*\})/);
    
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1].trim());
        console.log('[AI Mapping] Parsed embedded JSON:', parsed);
        
        // Convert content to HTML paragraphs if it's plain text
        if (parsed.content && typeof parsed.content === 'string') {
          parsed.content = parsed.content
            .split('\n\n')
            .filter(p => p.trim())
            .map(p => `<p>${p.trim()}</p>`)
            .join('');
        }
        
        return {
          title: parsed.title,
          content: parsed.content,
          cta_text: parsed.cta_text,
          cta_url: parsed.cta_url,
          image_url: parsed.image_url
        };
      } catch (e) {
        console.warn('[AI Mapping] Failed to parse embedded JSON:', e);
      }
    }
    
    // Legacy fallback: treat as body content only, convert to HTML
    const htmlContent = response
      .split('\n\n')
      .filter(p => p.trim())
      .map(p => `<p>${p.trim()}</p>`)
      .join('');
      
    return { 
      title: undefined, 
      content: htmlContent, 
      cta_text: undefined, 
      cta_url: undefined,
      image_url: undefined
    };
  }
  
  // Handle structured response - ensure content is HTML
  const result = response || {};
  if (result.content && typeof result.content === 'string' && !result.content.includes('<')) {
    result.content = result.content
      .split('\n\n')
      .filter(p => p.trim())
      .map(p => `<p>${p.trim()}</p>`)
      .join('');
  }
  
  console.log('[AI Mapping] Normalized response:', result);
  return result;
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