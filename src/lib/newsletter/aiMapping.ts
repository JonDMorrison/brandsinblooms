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
        
        // Map alternative field names (AI sometimes uses different keys)
        const normalized = {
          title: parsed.title || parsed.headline || parsed.heading,
          content: parsed.content || parsed.body || parsed.description,
          cta_text: parsed.cta_text || parsed.ctaText || parsed.buttonText || parsed.button_text,
          cta_url: parsed.cta_url || parsed.ctaUrl || parsed.buttonUrl || parsed.button_url,
          image_url: parsed.image_url || parsed.imageUrl || parsed.image
        };
        
        // Convert content to HTML paragraphs if it's plain text
        if (normalized.content && typeof normalized.content === 'string' && !normalized.content.includes('<')) {
          normalized.content = normalized.content
            .split('\n\n')
            .filter(p => p.trim())
            .map(p => `<p>${p.trim()}</p>`)
            .join('');
        }
        
        console.log('[AI Mapping] Normalized embedded JSON:', normalized);
        return normalized;
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
      
    console.log('[AI Mapping] Using string fallback, converted to HTML');
    return { 
      title: undefined, 
      content: htmlContent, 
      cta_text: undefined, 
      cta_url: undefined,
      image_url: undefined
    };
  }
  
  // Handle structured response - map alternative field names and ensure content is HTML
  const result = response as any; // Cast to any to handle various field names from AI
  
  const normalized = {
    title: result.title || result.headline || result.heading,
    content: result.content || result.body || result.description,
    cta_text: result.cta_text || result.ctaText || result.buttonText || result.button_text,
    cta_url: result.cta_url || result.ctaUrl || result.buttonUrl || result.button_url,
    image_url: result.image_url || result.imageUrl || result.image
  };
  
  // Convert content to HTML paragraphs if it's plain text
  if (normalized.content && typeof normalized.content === 'string' && !normalized.content.includes('<')) {
    normalized.content = normalized.content
      .split('\n\n')
      .filter(p => p.trim())
      .map(p => `<p>${p.trim()}</p>`)
      .join('');
  }
  
  console.log('[AI Mapping] Normalized structured response:', normalized);
  return normalized;
}

/**
 * Maps AI response fields to block properties using flexible field mapping
 */
export function applyAIToBlock(block: any, ai: NormalizedAIResponse): any {
  const updated = { ...block };

  console.log('[AI Mapping] Applying AI to block:', { blockId: block.id, ai, originalBlock: block });

  // Only apply AI content if we have meaningful data
  // Safeguard against overwriting with empty/placeholder content
  const hasValidTitle = ai.title && ai.title.trim() && 
    ai.title !== 'AI Generated Content' && 
    !ai.title.includes('```') &&
    ai.title.length > 3;
    
  const hasValidContent = ai.content && ai.content.trim() && 
    ai.content !== '<p>Add text content</p>' && 
    !ai.content.includes('```json') &&
    ai.content.length > 10;

  // Title/headline mapping - try various field names
  if (hasValidTitle) {
    const titleValue = ai.title;
    if ('title' in updated) updated.title = titleValue;
    if ('headline' in updated) updated.headline = titleValue;
    if ('heading' in updated) updated.heading = titleValue;
    console.log('[AI Mapping] Applied title:', titleValue);
  } else {
    console.warn('[AI Mapping] Skipping invalid title:', ai.title);
  }

  // Body/content/description mapping
  if (hasValidContent) {
    const contentValue = ai.content;
    if ('body' in updated) updated.body = contentValue;
    if ('content' in updated) updated.content = contentValue;
    if ('description' in updated) updated.description = contentValue;
    console.log('[AI Mapping] Applied content length:', contentValue.length);
  } else {
    console.warn('[AI Mapping] Skipping invalid content:', ai.content);
  }

  // CTA text mapping
  const ctaTextValue = ai.cta_text;
  if (ctaTextValue && ctaTextValue.trim()) {
    if ('ctaText' in updated) updated.ctaText = ctaTextValue;
    if ('buttonText' in updated) updated.buttonText = ctaTextValue;
    if ('cta_label' in updated) updated.cta_label = ctaTextValue;
    console.log('[AI Mapping] Applied CTA text:', ctaTextValue);
  }

  // CTA URL mapping
  const ctaUrlValue = ai.cta_url;
  if (ctaUrlValue && ctaUrlValue.trim()) {
    if ('ctaUrl' in updated) updated.ctaUrl = ctaUrlValue;
    if ('buttonUrl' in updated) updated.buttonUrl = ctaUrlValue;
    if ('href' in updated) updated.href = ctaUrlValue;
    console.log('[AI Mapping] Applied CTA URL:', ctaUrlValue);
  }

  // Image URL mapping
  if (ai.image_url && ai.image_url.trim()) {
    if ('image' in updated) {
      updated.image = { ...(updated.image || {}), url: ai.image_url };
    }
    if ('imageUrl' in updated) {
      updated.imageUrl = ai.image_url;
    }
    console.log('[AI Mapping] Applied image URL:', ai.image_url);
  }

  console.log('[AI Mapping] Updated block result:', updated);
  return updated;
}