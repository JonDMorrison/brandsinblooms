/**
 * Shared Email HTML Renderer with Merge Tags
 * 
 * Single source of truth for rendering merge tags in email HTML.
 * Used by both preview and send pipelines.
 */

import { 
  renderMergeTags, 
  convertLegacyTags, 
  createMergeTagDataFromCustomer, 
  GLOBAL_FALLBACKS,
  type MergeTagData 
} from "./mergeTagEngine.ts";

export interface RenderEmailHtmlOptions {
  tenantId: string;
  html: string;
  mode: 'preview' | 'send';
  customer?: Record<string, unknown>;
  sampleCustomer?: {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    custom?: Record<string, unknown>;
  };
  companyInfo?: Record<string, unknown>;
}

export interface RenderDiagnostics {
  usedTags: string[];
  missingTags: string[];
  emptyResolvedTags: string[];
  legacyTagsConverted: number;
}

export interface RenderEmailHtmlResult {
  success: boolean;
  renderedHtml: string;
  diagnostics: RenderDiagnostics;
}

/**
 * Normalize escaped HTML entities back to merge tag syntax
 */
export function normalizeMergeTagsInHtml(html: string): string {
  if (!html) return '';
  
  let result = html;
  
  // Decode HTML entities for curly braces
  result = result
    .replace(/&#123;&#123;/g, '{{')
    .replace(/&#125;&#125;/g, '}}')
    .replace(/&lbrace;&lbrace;/g, '{{')
    .replace(/&rbrace;&rbrace;/g, '}}')
    .replace(/%7B%7B/g, '{{')
    .replace(/%7D%7D/g, '}}');
  
  return result;
}

/**
 * Extract all merge tags from a template
 */
function extractAllTags(template: string): string[] {
  const MERGE_TAG_REGEX = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\s*(?:\|\s*default:\s*["'][^"']*["'])?\s*\}\}/g;
  const tags: string[] = [];
  let match;
  
  while ((match = MERGE_TAG_REGEX.exec(template)) !== null) {
    tags.push(match[0]);
  }
  
  return [...new Set(tags)];
}

/**
 * Count legacy tags that will be converted
 */
function countLegacyTags(template: string): number {
  const LEGACY_REGEX = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
  let count = 0;
  let match;
  
  while ((match = LEGACY_REGEX.exec(template)) !== null) {
    count++;
  }
  
  return count;
}

/**
 * Check which tags resolved to empty values
 */
function findEmptyResolvedTags(
  originalHtml: string, 
  renderedHtml: string, 
  mergeData: MergeTagData
): string[] {
  const MERGE_TAG_REGEX = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\s*(?:\|\s*default:\s*["']([^"']*)["'])?\s*\}\}/g;
  const emptyTags: string[] = [];
  let match;
  
  while ((match = MERGE_TAG_REGEX.exec(originalHtml)) !== null) {
    const fullTag = match[0];
    const fieldPath = match[1];
    const explicitDefault = match[2];
    
    // Get the value from merge data
    const value = getNestedValue(mergeData as Record<string, unknown>, fieldPath);
    
    // Check if it resolved to empty (no value, no default, no global fallback)
    if (
      (value === null || value === undefined || value === '') &&
      (explicitDefault === undefined || explicitDefault === '') &&
      (!GLOBAL_FALLBACKS[fieldPath] || GLOBAL_FALLBACKS[fieldPath] === '')
    ) {
      emptyTags.push(fullTag);
    }
  }
  
  return [...new Set(emptyTags)];
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  
  return current;
}

/**
 * Render email HTML with merge tags
 * 
 * This is the single source of truth for merge tag rendering.
 * Both preview and send pipelines MUST use this function.
 */
export function renderEmailHtmlWithMergeTags(
  options: RenderEmailHtmlOptions
): RenderEmailHtmlResult {
  const { html, customer, sampleCustomer, companyInfo, mode } = options;
  
  // Step 1: Normalize any escaped merge tags
  let normalizedHtml = normalizeMergeTagsInHtml(html);
  
  // Step 2: Count legacy tags before conversion
  const legacyTagsConverted = countLegacyTags(normalizedHtml);
  
  // Step 3: Convert legacy tags to modern syntax
  const convertedHtml = convertLegacyTags(normalizedHtml);
  
  // Step 4: Extract all tags for diagnostics
  const usedTags = extractAllTags(convertedHtml);
  
  // Step 5: Build merge data
  let mergeData: MergeTagData;
  
  if (customer) {
    // Real customer from database
    mergeData = createMergeTagDataFromCustomer(customer, companyInfo || {});
  } else if (sampleCustomer) {
    // Sample customer for preview
    mergeData = {
      first_name: sampleCustomer.first_name || null,
      last_name: sampleCustomer.last_name || null,
      email: sampleCustomer.email || null,
      phone: sampleCustomer.phone || null,
      custom: sampleCustomer.custom || {},
      company: {
        name: (companyInfo?.company_name as string) || null,
        address: (companyInfo?.address as string) || null,
        phone: (companyInfo?.phone as string) || null,
        email: (companyInfo?.email as string) || null,
        website: (companyInfo?.website_url as string) || null,
      },
    };
  } else {
    // No customer context - use empty data (tags will use fallbacks)
    mergeData = {
      company: {
        name: (companyInfo?.company_name as string) || null,
      },
    };
  }
  
  // Step 6: Find tags that will resolve to empty
  const emptyResolvedTags = findEmptyResolvedTags(convertedHtml, '', mergeData);
  
  // Step 7: Find truly missing tags (not in data and no fallback)
  const missingTags = usedTags.filter(tag => {
    const fieldMatch = tag.match(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*)/);
    if (!fieldMatch) return false;
    
    const fieldPath = fieldMatch[1];
    const value = getNestedValue(mergeData as Record<string, unknown>, fieldPath);
    const hasGlobalFallback = GLOBAL_FALLBACKS[fieldPath] !== undefined;
    const hasExplicitDefault = tag.includes('| default:');
    
    return value === undefined && !hasGlobalFallback && !hasExplicitDefault;
  });
  
  // Step 8: Render merge tags
  const renderedHtml = renderMergeTags(convertedHtml, mergeData);
  
  // Step 9: Log for debugging
  console.log(`[renderEmailHtml] mode=${mode}, usedTags=${usedTags.length}, legacyConverted=${legacyTagsConverted}, missing=${missingTags.length}`);
  
  return {
    success: true,
    renderedHtml,
    diagnostics: {
      usedTags,
      missingTags,
      emptyResolvedTags,
      legacyTagsConverted,
    },
  };
}

export default renderEmailHtmlWithMergeTags;
