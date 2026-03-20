import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

// ============= LOCATION EXTRACTION TYPES =============
interface LocationCandidate {
  postal_code: string;
  city?: string;
  state_province?: string;
  country?: 'US' | 'CA' | null;
  source: 'jsonld' | 'footer' | 'contact' | 'regex' | 'ai';
  snippet: string;
  confidence: 'high' | 'medium' | 'low';
}

interface LocationResult {
  postal_code: string | null;
  city: string | null;
  state_province: string | null;
  country: 'US' | 'CA' | null;
  source: 'jsonld' | 'footer' | 'contact' | 'regex' | 'ai' | 'none';
  confidence: 'high' | 'medium' | 'low';
  snippet: string | null;
  candidates: LocationCandidate[];
  location_info: string; // Free-form fallback
}

// ============= REGEX PATTERNS =============
// US ZIP: 5 digits, optionally followed by -4 digits
const US_ZIP_REGEX = /\b(\d{5})(?:-(\d{4}))?\b/g;

// Canadian Postal: Letter-Digit-Letter Space? Digit-Letter-Digit (case insensitive)
// Valid first letters: ABCEGHJ-NPRSTVXY (no D, F, I, O, Q, U, W, Z)
const CA_POSTAL_REGEX = /\b([ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z])\s?(\d[ABCEGHJ-NPRSTV-Z]\d)\b/gi;

// State/Province abbreviations
const US_STATES: Record<string, string> = {
  'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
  'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
  'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
  'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
  'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
  'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
  'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
  'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
  'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
  'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming',
  'DC': 'District of Columbia'
};

const CA_PROVINCES: Record<string, string> = {
  'AB': 'Alberta', 'BC': 'British Columbia', 'MB': 'Manitoba', 'NB': 'New Brunswick',
  'NL': 'Newfoundland and Labrador', 'NS': 'Nova Scotia', 'NT': 'Northwest Territories',
  'NU': 'Nunavut', 'ON': 'Ontario', 'PE': 'Prince Edward Island', 'QC': 'Quebec',
  'SK': 'Saskatchewan', 'YT': 'Yukon'
};

// ============= LOCATION EXTRACTION FUNCTIONS =============

function normalizeCanadianPostal(match: string): string {
  // Normalize to "A1A 1A1" format
  const cleaned = match.replace(/\s/g, '').toUpperCase();
  return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
}

function extractSnippet(text: string, matchIndex: number, matchLength: number, contextLength: number = 80): string {
  const start = Math.max(0, matchIndex - contextLength);
  const end = Math.min(text.length, matchIndex + matchLength + contextLength);
  let snippet = text.slice(start, end).replace(/\s+/g, ' ').trim();
  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';
  return snippet;
}

function findStateOrProvince(text: string, postalIndex: number): { abbr: string; name: string; country: 'US' | 'CA' } | null {
  // Look within 100 chars before the postal code for state/province
  const searchStart = Math.max(0, postalIndex - 100);
  const searchText = text.slice(searchStart, postalIndex).toUpperCase();
  
  // Check US states first
  for (const [abbr, name] of Object.entries(US_STATES)) {
    // Look for "State," or "ST " patterns
    const patterns = [
      new RegExp(`\\b${abbr}\\b[,\\s]`, 'i'),
      new RegExp(`\\b${name}\\b[,\\s]`, 'i')
    ];
    for (const pattern of patterns) {
      if (pattern.test(searchText)) {
        return { abbr, name, country: 'US' };
      }
    }
  }
  
  // Check Canadian provinces
  for (const [abbr, name] of Object.entries(CA_PROVINCES)) {
    const patterns = [
      new RegExp(`\\b${abbr}\\b[,\\s]`, 'i'),
      new RegExp(`\\b${name}\\b[,\\s]`, 'i')
    ];
    for (const pattern of patterns) {
      if (pattern.test(searchText)) {
        return { abbr, name, country: 'CA' };
      }
    }
  }
  
  return null;
}

function extractCityFromContext(text: string, postalIndex: number): string | null {
  // Look for city in the 80 chars before the postal code
  const searchStart = Math.max(0, postalIndex - 80);
  const searchText = text.slice(searchStart, postalIndex);
  
  // Pattern: "City, ST" or "City ST" before postal
  const cityMatch = searchText.match(/([A-Z][a-zA-Z\s-]{2,30})[,\s]+(?:[A-Z]{2})[,\s]*$/);
  if (cityMatch) {
    return cityMatch[1].trim();
  }
  
  return null;
}

function extractFromJsonLd(htmlContent: string): LocationCandidate[] {
  const candidates: LocationCandidate[] = [];
  
  // Find all JSON-LD scripts
  const jsonLdMatches = htmlContent.matchAll(/<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  
  for (const match of jsonLdMatches) {
    try {
      const jsonContent = match[1].trim();
      const data = JSON.parse(jsonContent);
      
      // Handle both single objects and arrays
      const items = Array.isArray(data) ? data : [data];
      
      for (const item of items) {
        // Look for LocalBusiness, Organization, or Place with address
        const address = item.address || item.location?.address;
        if (address) {
          const postalCode = address.postalCode || address.PostalCode;
          const city = address.addressLocality || address.city;
          const state = address.addressRegion || address.state;
          const country = address.addressCountry;
          
          if (postalCode) {
            const normalizedPostal = normalizePostalCode(postalCode);
            if (normalizedPostal) {
              candidates.push({
                postal_code: normalizedPostal.code,
                city: city || null,
                state_province: state || null,
                country: normalizedPostal.country,
                source: 'jsonld',
                snippet: `Schema.org: ${city || ''}, ${state || ''} ${postalCode}`.trim(),
                confidence: 'high'
              });
            }
          }
        }
        
        // Also check @graph if present
        if (item['@graph']) {
          for (const graphItem of item['@graph']) {
            const gAddress = graphItem.address || graphItem.location?.address;
            if (gAddress) {
              const postalCode = gAddress.postalCode || gAddress.PostalCode;
              if (postalCode) {
                const normalizedPostal = normalizePostalCode(postalCode);
                if (normalizedPostal) {
                  candidates.push({
                    postal_code: normalizedPostal.code,
                    city: gAddress.addressLocality || null,
                    state_province: gAddress.addressRegion || null,
                    country: normalizedPostal.country,
                    source: 'jsonld',
                    snippet: `Schema.org @graph: ${gAddress.addressLocality || ''}, ${gAddress.addressRegion || ''} ${postalCode}`.trim(),
                    confidence: 'high'
                  });
                }
              }
            }
          }
        }
      }
    } catch (e) {
      // Invalid JSON, continue
    }
  }
  
  return candidates;
}

function normalizePostalCode(code: string): { code: string; country: 'US' | 'CA' } | null {
  const cleaned = code.replace(/\s/g, '').toUpperCase();
  
  // Check if it's a US ZIP
  if (/^\d{5}(-\d{4})?$/.test(cleaned)) {
    return { code: cleaned, country: 'US' };
  }
  
  // Check if it's a Canadian postal code
  if (/^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z]\d[ABCEGHJ-NPRSTV-Z]\d$/.test(cleaned)) {
    return { code: `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`, country: 'CA' };
  }
  
  return null;
}

function extractFromFooter(htmlContent: string): LocationCandidate[] {
  const candidates: LocationCandidate[] = [];
  
  // Find footer sections
  const footerMatches = htmlContent.matchAll(/<footer[^>]*>([\s\S]*?)<\/footer>/gi);
  
  for (const footerMatch of footerMatches) {
    const footerContent = footerMatch[1];
    const cleanFooter = footerContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    
    // Extract US ZIPs from footer
    const usZipMatches = cleanFooter.matchAll(US_ZIP_REGEX);
    for (const match of usZipMatches) {
      const zip = match[1] + (match[2] ? `-${match[2]}` : '');
      const index = cleanFooter.indexOf(match[0]);
      const stateInfo = findStateOrProvince(cleanFooter, index);
      const city = extractCityFromContext(cleanFooter, index);
      
      // High confidence if we found state context
      const confidence = stateInfo ? 'high' : 'medium';
      
      candidates.push({
        postal_code: zip,
        city: city,
        state_province: stateInfo?.abbr || null,
        country: 'US',
        source: 'footer',
        snippet: extractSnippet(cleanFooter, index, match[0].length),
        confidence
      });
    }
    
    // Extract Canadian postal codes from footer
    const caPostalMatches = cleanFooter.matchAll(CA_POSTAL_REGEX);
    for (const match of caPostalMatches) {
      const postal = normalizeCanadianPostal(match[0]);
      const index = cleanFooter.indexOf(match[0]);
      const provinceInfo = findStateOrProvince(cleanFooter, index);
      const city = extractCityFromContext(cleanFooter, index);
      
      const confidence = provinceInfo ? 'high' : 'medium';
      
      candidates.push({
        postal_code: postal,
        city: city,
        state_province: provinceInfo?.abbr || null,
        country: 'CA',
        source: 'footer',
        snippet: extractSnippet(cleanFooter, index, match[0].length),
        confidence
      });
    }
  }
  
  return candidates;
}

function extractFromContactPage(textContent: string): LocationCandidate[] {
  const candidates: LocationCandidate[] = [];
  
  // Look for common contact section indicators
  const contactPatterns = [
    /contact\s*(?:us|info)?/gi,
    /our\s+location/gi,
    /find\s+us/gi,
    /visit\s+us/gi,
    /address/gi
  ];
  
  let isContactSection = false;
  for (const pattern of contactPatterns) {
    if (pattern.test(textContent)) {
      isContactSection = true;
      break;
    }
  }
  
  if (!isContactSection) {
    return candidates;
  }
  
  // Extract US ZIPs
  const usZipMatches = textContent.matchAll(US_ZIP_REGEX);
  for (const match of usZipMatches) {
    const zip = match[1] + (match[2] ? `-${match[2]}` : '');
    const index = textContent.indexOf(match[0]);
    const stateInfo = findStateOrProvince(textContent, index);
    const city = extractCityFromContext(textContent, index);
    
    const confidence = stateInfo ? 'high' : 'medium';
    
    candidates.push({
      postal_code: zip,
      city: city,
      state_province: stateInfo?.abbr || null,
      country: 'US',
      source: 'contact',
      snippet: extractSnippet(textContent, index, match[0].length),
      confidence
    });
  }
  
  // Extract Canadian postal codes
  const caPostalMatches = textContent.matchAll(CA_POSTAL_REGEX);
  for (const match of caPostalMatches) {
    const postal = normalizeCanadianPostal(match[0]);
    const index = textContent.indexOf(match[0]);
    const provinceInfo = findStateOrProvince(textContent, index);
    const city = extractCityFromContext(textContent, index);
    
    const confidence = provinceInfo ? 'high' : 'medium';
    
    candidates.push({
      postal_code: postal,
      city: city,
      state_province: provinceInfo?.abbr || null,
      country: 'CA',
      source: 'contact',
      snippet: extractSnippet(textContent, index, match[0].length),
      confidence
    });
  }
  
  return candidates;
}

function extractViaRegex(textContent: string): LocationCandidate[] {
  const candidates: LocationCandidate[] = [];
  
  // Extract US ZIPs with regex scan
  const usZipMatches = textContent.matchAll(US_ZIP_REGEX);
  for (const match of usZipMatches) {
    const zip = match[1] + (match[2] ? `-${match[2]}` : '');
    const index = textContent.indexOf(match[0]);
    const stateInfo = findStateOrProvince(textContent, index);
    const city = extractCityFromContext(textContent, index);
    
    // Regex-only is lower confidence
    const confidence = stateInfo ? 'medium' : 'low';
    
    candidates.push({
      postal_code: zip,
      city: city,
      state_province: stateInfo?.abbr || null,
      country: 'US',
      source: 'regex',
      snippet: extractSnippet(textContent, index, match[0].length),
      confidence
    });
  }
  
  // Extract Canadian postal codes with regex
  const caPostalMatches = textContent.matchAll(CA_POSTAL_REGEX);
  for (const match of caPostalMatches) {
    const postal = normalizeCanadianPostal(match[0]);
    const index = textContent.indexOf(match[0]);
    const provinceInfo = findStateOrProvince(textContent, index);
    const city = extractCityFromContext(textContent, index);
    
    const confidence = provinceInfo ? 'medium' : 'low';
    
    candidates.push({
      postal_code: postal,
      city: city,
      state_province: provinceInfo?.abbr || null,
      country: 'CA',
      source: 'regex',
      snippet: extractSnippet(textContent, index, match[0].length),
      confidence
    });
  }
  
  return candidates;
}

// ============= AI-ASSISTED ADDRESS EXTRACTION =============
async function extractViaAI(textContent: string, openAIApiKey: string): Promise<LocationCandidate[]> {
  const candidates: LocationCandidate[] = [];
  
  if (!openAIApiKey) {
    console.log('⚠️ AI extraction skipped: no API key');
    return candidates;
  }
  
  try {
    console.log('🤖 Attempting AI-assisted address extraction');
    
    // Take a focused sample of content (first 4000 chars to save tokens)
    const contentSample = textContent.slice(0, 4000);
    
    const addressPrompt = `Find the business address from this website content. Return ONLY valid JSON:

${contentSample}

Extract the business physical address and return JSON in this exact format:
{
  "found": true or false,
  "street": "street address if found",
  "city": "city name",
  "state": "2-letter state/province code (e.g., CA, NY, ON, BC)",
  "postalCode": "ZIP or postal code (e.g., 90210 or M5V 2T3)",
  "country": "US or CA"
}

CRITICAL:
- Return ONLY the JSON object, no other text
- If no address found, return {"found": false}
- Look for contact pages, footer addresses, about us sections
- postalCode should be 5 digits for US (optionally with -4 extension) or A1A 1A1 format for Canada
- Only return addresses that appear to be the business's physical location, not customer addresses`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: 'You are an expert at finding business addresses in website content. Always respond with valid JSON only.'
          },
          { role: 'user', content: addressPrompt }
        ],
        temperature: 0.1,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      console.log('⚠️ AI address extraction API error:', response.status);
      return candidates;
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content?.trim();
    
    if (!content) {
      console.log('⚠️ AI address extraction returned empty content');
      return candidates;
    }

    // Parse the JSON response
    let jsonString = content.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonString = jsonMatch[0];
    }
    
    const addressData = JSON.parse(jsonString);
    
    if (!addressData.found || !addressData.postalCode) {
      console.log('📍 AI extraction: no address found in content');
      return candidates;
    }

    // Validate and normalize the postal code
    const normalizedPostal = normalizePostalCode(addressData.postalCode);
    if (!normalizedPostal) {
      console.log('⚠️ AI extraction: invalid postal code format:', addressData.postalCode);
      return candidates;
    }

    // Determine country from postal code format if not provided
    const country = normalizedPostal.country;
    
    // Validate state/province matches country
    let stateProvince = addressData.state?.toUpperCase() || null;
    if (stateProvince) {
      if (country === 'US' && !US_STATES[stateProvince]) {
        stateProvince = null; // Invalid US state
      } else if (country === 'CA' && !CA_PROVINCES[stateProvince]) {
        stateProvince = null; // Invalid CA province
      }
    }

    const snippet = [
      addressData.street,
      addressData.city,
      stateProvince,
      normalizedPostal.code
    ].filter(Boolean).join(', ');

    candidates.push({
      postal_code: normalizedPostal.code,
      city: addressData.city || null,
      state_province: stateProvince,
      country: country,
      source: 'ai',
      snippet: `AI extracted: ${snippet}`,
      confidence: 'medium' // AI extraction is medium confidence
    });

    console.log('✅ AI address extraction successful:', normalizedPostal.code);
    
  } catch (error) {
    console.log('⚠️ AI address extraction error:', error.message);
  }
  
  return candidates;
}

function deduplicateCandidates(candidates: LocationCandidate[]): LocationCandidate[] {
  const seen = new Map<string, LocationCandidate>();
  
  for (const candidate of candidates) {
    const key = candidate.postal_code.replace(/\s/g, '').toUpperCase();
    const existing = seen.get(key);
    
    if (!existing) {
      seen.set(key, candidate);
    } else {
      // Keep the one with higher confidence or better source
      // AI ranks between contact and regex since it's a fallback
      const sourceRank = { jsonld: 5, footer: 4, contact: 3, ai: 2, regex: 1 };
      const confidenceRank = { high: 3, medium: 2, low: 1 };
      
      const existingScore = sourceRank[existing.source] * 10 + confidenceRank[existing.confidence];
      const newScore = sourceRank[candidate.source] * 10 + confidenceRank[candidate.confidence];
      
      if (newScore > existingScore) {
        seen.set(key, candidate);
      }
    }
  }
  
  return Array.from(seen.values());
}

// Synchronous extraction (without AI) - used for initial pass
function extractLocationSync(htmlContent: string, textContent: string): { candidates: LocationCandidate[], hasHighConfidence: boolean } {
  let allCandidates: LocationCandidate[] = [];
  
  // Priority 1: JSON-LD extraction
  const jsonLdCandidates = extractFromJsonLd(htmlContent);
  allCandidates.push(...jsonLdCandidates);
  
  // Priority 2: Footer extraction
  const footerCandidates = extractFromFooter(htmlContent);
  allCandidates.push(...footerCandidates);
  
  // Priority 3: Contact page patterns
  const contactCandidates = extractFromContactPage(textContent);
  allCandidates.push(...contactCandidates);
  
  // Priority 4: Regex scan (only if we don't have high-confidence results)
  const hasHighConfidence = allCandidates.some(c => c.confidence === 'high');
  if (!hasHighConfidence) {
    const regexCandidates = extractViaRegex(textContent);
    allCandidates.push(...regexCandidates);
  }
  
  return { candidates: allCandidates, hasHighConfidence };
}

// Build final result from candidates
function buildLocationResult(allCandidates: LocationCandidate[]): LocationResult {
  // Deduplicate
  const dedupedCandidates = deduplicateCandidates(allCandidates);
  
  // If no candidates found
  if (dedupedCandidates.length === 0) {
    return {
      postal_code: null,
      city: null,
      state_province: null,
      country: null,
      source: 'none',
      confidence: 'low',
      snippet: null,
      candidates: [],
      location_info: ''
    };
  }
  
  // Sort by confidence and source priority
  // AI ranks between contact and regex since it's a fallback
  const sourceRank = { jsonld: 5, footer: 4, contact: 3, ai: 2, regex: 1 };
  const confidenceRank = { high: 3, medium: 2, low: 1 };
  
  dedupedCandidates.sort((a, b) => {
    const aScore = confidenceRank[a.confidence] * 10 + sourceRank[a.source];
    const bScore = confidenceRank[b.confidence] * 10 + sourceRank[b.source];
    return bScore - aScore;
  });
  
  const bestCandidate = dedupedCandidates[0];
  
  // If multiple unique postal codes, set confidence to low
  const uniquePostals = new Set(dedupedCandidates.map(c => c.postal_code.replace(/\s/g, '').toUpperCase()));
  const finalConfidence = uniquePostals.size > 1 ? 'low' : bestCandidate.confidence;
  
  // Build location_info string
  const locationParts = [
    bestCandidate.city,
    bestCandidate.state_province,
    bestCandidate.postal_code,
    bestCandidate.country
  ].filter(Boolean);
  
  return {
    postal_code: bestCandidate.postal_code,
    city: bestCandidate.city || null,
    state_province: bestCandidate.state_province || null,
    country: bestCandidate.country,
    source: bestCandidate.source,
    confidence: finalConfidence,
    snippet: bestCandidate.snippet,
    candidates: dedupedCandidates,
    location_info: locationParts.join(', ')
  };
}

// Full extraction with optional AI fallback
async function extractLocationWithAI(htmlContent: string, textContent: string, openAIApiKey: string | undefined): Promise<LocationResult> {
  // First, try synchronous extraction methods
  const { candidates, hasHighConfidence } = extractLocationSync(htmlContent, textContent);
  
  // If we have high-confidence results or any medium-confidence results, use them
  const hasMediumConfidence = candidates.some(c => c.confidence === 'medium');
  if (hasHighConfidence || hasMediumConfidence) {
    console.log('📍 Using deterministic extraction results (high/medium confidence found)');
    return buildLocationResult(candidates);
  }
  
  // Priority 5: AI extraction (only if no good results from deterministic methods)
  if (openAIApiKey && candidates.length === 0) {
    console.log('📍 No deterministic results, trying AI extraction');
    const aiCandidates = await extractViaAI(textContent, openAIApiKey);
    candidates.push(...aiCandidates);
  }
  
  return buildLocationResult(candidates);
}

// Legacy synchronous function for tests
function extractLocation(htmlContent: string, textContent: string): LocationResult {
  const { candidates } = extractLocationSync(htmlContent, textContent);
  return buildLocationResult(candidates);
}

// ============= TEST HARNESS =============
function runLocationTests(): { passed: boolean; results: any[] } {
  const results: any[] = [];
  
  // Test 1: US ZIP in footer
  const usFooterHtml = `
    <html>
      <body>
        <footer>
          <p>Visit us at 123 Main Street, Portland, OR 97201</p>
        </footer>
      </body>
    </html>
  `;
  const usFooterText = 'Visit us at 123 Main Street, Portland, OR 97201';
  const usResult = extractLocation(usFooterHtml, usFooterText);
  results.push({
    test: 'US ZIP in footer',
    expected: { postal_code: '97201', country: 'US', confidence: 'high' },
    actual: { postal_code: usResult.postal_code, country: usResult.country, confidence: usResult.confidence },
    passed: usResult.postal_code === '97201' && usResult.country === 'US' && usResult.confidence === 'high'
  });
  
  // Test 2: Canadian postal in contact section
  const caContactHtml = '<html><body><div>Contact us today!</div></body></html>';
  const caContactText = 'Contact us at our Toronto, ON location: M5V 2T3. We look forward to hearing from you!';
  const caResult = extractLocation(caContactHtml, caContactText);
  results.push({
    test: 'Canadian postal in contact page',
    expected: { postal_code: 'M5V 2T3', country: 'CA', confidence: 'high' },
    actual: { postal_code: caResult.postal_code, country: caResult.country, confidence: caResult.confidence },
    passed: caResult.postal_code === 'M5V 2T3' && caResult.country === 'CA'
  });
  
  // Test 3: Multiple locations (should return low confidence)
  const multiHtml = `
    <html>
      <footer>
        <p>Seattle, WA 98101</p>
        <p>Portland, OR 97201</p>
      </footer>
    </html>
  `;
  const multiText = 'Seattle, WA 98101 and Portland, OR 97201';
  const multiResult = extractLocation(multiHtml, multiText);
  results.push({
    test: 'Multiple locations - low confidence',
    expected: { confidence: 'low', candidateCount: 2 },
    actual: { confidence: multiResult.confidence, candidateCount: multiResult.candidates.length },
    passed: multiResult.confidence === 'low' && multiResult.candidates.length >= 2
  });
  
  // Test 4: JSON-LD extraction
  const jsonLdHtml = `
    <html>
      <head>
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "LocalBusiness",
          "name": "Test Garden Center",
          "address": {
            "@type": "PostalAddress",
            "streetAddress": "456 Garden Way",
            "addressLocality": "Denver",
            "addressRegion": "CO",
            "postalCode": "80202",
            "addressCountry": "US"
          }
        }
        </script>
      </head>
      <body></body>
    </html>
  `;
  const jsonLdResult = extractLocation(jsonLdHtml, '');
  results.push({
    test: 'JSON-LD extraction',
    expected: { postal_code: '80202', source: 'jsonld', confidence: 'high' },
    actual: { postal_code: jsonLdResult.postal_code, source: jsonLdResult.source, confidence: jsonLdResult.confidence },
    passed: jsonLdResult.postal_code === '80202' && jsonLdResult.source === 'jsonld' && jsonLdResult.confidence === 'high'
  });
  
  const allPassed = results.every(r => r.passed);
  return { passed: allPassed, results };
}

// ============= URL VALIDATION =============
const validateUrl = (url: string): { isValid: boolean; normalizedUrl?: string; error?: string } => {
  try {
    let normalizedUrl = url.trim();
    
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = `https://${normalizedUrl}`;
    }
    
    const urlObj = new URL(normalizedUrl);
    
    if (!urlObj.hostname || urlObj.hostname === 'localhost' || urlObj.hostname.includes('127.0.0.1')) {
      return {
        isValid: false,
        error: 'Local URLs are not supported. Please enter a public website URL.'
      };
    }
    
    return { isValid: true, normalizedUrl };
  } catch (error) {
    return {
      isValid: false,
      error: 'Invalid URL format. Please enter a valid website URL (e.g., https://example.com)'
    };
  }
};

// ============= MAIN HANDLER =============
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // SECURITY: [E27] - Add JWT authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), { status: 401, headers: corsHeaders });
    }

    console.log('🚀 Starting website analysis function');
    
    const { websiteUrl, runTests, companyProfileId } = await req.json();
    
    // Run test harness if requested
    if (runTests === true) {
      console.log('🧪 Running location extraction tests');
      const testResults = runLocationTests();
      console.log('🧪 Test results:', JSON.stringify(testResults, null, 2));
      return new Response(JSON.stringify({ testResults }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    console.log('📥 Received request for URL:', websiteUrl);
    if (companyProfileId) {
      console.log('📋 Company profile ID:', companyProfileId);
    }

    if (!websiteUrl) {
      console.error('❌ No website URL provided');
      return new Response(JSON.stringify({ 
        error: 'Website URL is required',
        type: 'validation'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!openAIApiKey) {
      console.error('❌ OpenAI API key not found');
      return new Response(JSON.stringify({ 
        error: 'OpenAI API key not configured',
        type: 'configuration'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const urlValidation = validateUrl(websiteUrl);
    if (!urlValidation.isValid) {
      console.error('❌ URL validation failed:', urlValidation.error);
      return new Response(JSON.stringify({ 
        error: urlValidation.error,
        type: 'validation'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const normalizedUrl = urlValidation.normalizedUrl!;
    console.log('✅ Analyzing website:', normalizedUrl);

    let websiteContent = '';
    let rawHtmlContent = '';
    let extractionMethod = '';
    let brandingData: any = null;

    // First, try the direct fetch method
    try {
      console.log('🔍 Attempting direct fetch from:', normalizedUrl);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      const response = await fetch(normalizedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Cache-Control': 'max-age=0',
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      console.log('📡 Direct fetch response status:', response.status, response.statusText);
      
      if (!response.ok) {
        throw new Error(`Website returned ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html')) {
        throw new Error('Website did not return HTML content');
      }

      rawHtmlContent = await response.text();
      websiteContent = rawHtmlContent;
      extractionMethod = 'direct';
      console.log('✅ Direct fetch successful, content length:', websiteContent.length);
      
    } catch (directFetchError) {
      console.log('⚠️ Direct fetch failed:', directFetchError.message);
      
      if (firecrawlApiKey) {
        try {
          console.log('🔥 Using Firecrawl API as fallback');
          
          const firecrawlResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${firecrawlApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              url: normalizedUrl,
              formats: ['markdown', 'html'],
              onlyMainContent: false,
              waitFor: 3000,
              timeout: 15000,
            }),
          });

          console.log('📡 Firecrawl response status:', firecrawlResponse.status);

          if (!firecrawlResponse.ok) {
            const errorText = await firecrawlResponse.text();
            console.error('❌ Firecrawl API error:', firecrawlResponse.status, errorText);
            throw new Error(`Firecrawl API error: ${firecrawlResponse.status}`);
          }

          const firecrawlData = await firecrawlResponse.json();
          const contentData = firecrawlData.data || firecrawlData;
          
          if (firecrawlData.success) {
            websiteContent = contentData?.markdown || '';
            rawHtmlContent = contentData?.html || '';
            extractionMethod = 'firecrawl';
            console.log('✅ Firecrawl extraction successful');
          } else {
            throw new Error('Firecrawl extraction failed');
          }
          
        } catch (firecrawlError) {
          console.error('❌ Firecrawl extraction failed:', firecrawlError.message);
          
          return new Response(JSON.stringify({ 
            error: `Unable to analyze website: ${directFetchError.message}`,
            type: 'extraction',
            details: {
              directFetchError: directFetchError.message,
              firecrawlError: firecrawlError.message,
              url: normalizedUrl
            }
          }), {
            status: 422,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } else {
        return new Response(JSON.stringify({ 
          error: `Website analysis failed: ${directFetchError.message}`,
          type: 'extraction',
          details: { error: directFetchError.message, url: normalizedUrl }
        }), {
          status: 422,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (!websiteContent || websiteContent.length < 100) {
      console.error('❌ Website content is too short:', websiteContent.length);
      return new Response(JSON.stringify({
        error: 'Website content is too short or empty.',
        type: 'extraction'
      }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ============= LOCATION EXTRACTION =============
    console.log('📍 Starting location extraction with AI fallback');
    
    // Clean text content for location analysis
    let cleanTextContent = websiteContent;
    if (extractionMethod === 'direct') {
      cleanTextContent = websiteContent
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/&[a-zA-Z0-9#]+;/g, ' ')
        .trim();
    }
    
    // Use async extraction with AI fallback
    const locationResult = await extractLocationWithAI(rawHtmlContent || websiteContent, cleanTextContent, openAIApiKey);
    
    // Structured logging for location extraction (PII-safe)
    console.log('📍 Location extraction result:', JSON.stringify({
      company_profile_id: companyProfileId || 'not_provided',
      website_url: normalizedUrl,
      detected_postal_code: locationResult.postal_code,
      source: locationResult.source,
      confidence: locationResult.confidence,
      candidate_count: locationResult.candidates.length,
      has_multiple_candidates: locationResult.candidates.length > 1,
      city_detected: !!locationResult.city,
      state_province_detected: !!locationResult.state_province,
      country_detected: locationResult.country
    }));

    // Try branding extraction
    if (firecrawlApiKey) {
      try {
        console.log('🎨 Attempting to extract brand colors via Firecrawl');
        
        const brandingResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${firecrawlApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: normalizedUrl,
            formats: ['branding'],
            waitFor: 3000,
            timeout: 10000,
          }),
        });

        if (brandingResponse.ok) {
          const brandingResult = await brandingResponse.json();
          const branding = brandingResult.data?.branding || brandingResult.branding;
          
          if (branding) {
            brandingData = {
              primaryColor: branding.colors?.primary || null,
              secondaryColor: branding.colors?.secondary || null,
              accentColor: branding.colors?.accent || null,
              backgroundColor: branding.colors?.background || null,
              textColor: branding.colors?.textPrimary || null,
              logo: branding.logo || branding.images?.logo || null,
              colorScheme: branding.colorScheme || null,
              fonts: branding.fonts || null,
            };
            console.log('✅ Brand colors extracted');
          }
        }
      } catch (brandingError) {
        console.log('⚠️ Branding extraction failed (non-critical):', brandingError.message);
      }
    }
    
    // Clean content for AI analysis
    let contentForAnalysis = cleanTextContent.slice(0, 8000);
    
    if (contentForAnalysis.length < 50) {
      console.error('❌ Content too short after cleaning');
      return new Response(JSON.stringify({
        error: 'Website content is too short after processing.',
        type: 'extraction'
      }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('🤖 Content ready for OpenAI analysis');

    const prompt = `Analyze this website content and extract business information. Return ONLY valid JSON:

${contentForAnalysis}

Extract and return JSON in this exact format:
{
  "businessName": "exact business name found",
  "aboutBusiness": "detailed description of what they do",
  "location": "city, state, or address if found",
  "services": "products, services, specializations they offer",
  "brandVoice": "actual sentences showing their writing style",
  "annualEvents": "seasonal events, sales, workshops mentioned"
}

CRITICAL: 
- Return ONLY the JSON object, no other text
- Use empty strings "" if information is not found
- Extract any garden center, nursery, landscaping, or plant-related information
- Focus on finding their business name, location, and what they sell`;

    console.log('📤 Sending request to OpenAI');

    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: 'You are an expert at analyzing websites to extract business information. Always respond with valid JSON only.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 1000,
      }),
    });

    console.log('📡 OpenAI response status:', openAIResponse.status);

    if (!openAIResponse.ok) {
      const errorText = await openAIResponse.text();
      console.error('❌ OpenAI API error:', openAIResponse.status, errorText);
      return new Response(JSON.stringify({
        error: `AI analysis failed: ${openAIResponse.status}`,
        type: 'ai_processing'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await openAIResponse.json();

    let extractedData;
    try {
      const content = data.choices[0].message.content.trim();
      let jsonString = content.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonString = jsonMatch[0];
      }
      
      extractedData = JSON.parse(jsonString);
      
      const requiredFields = ['businessName', 'aboutBusiness', 'location', 'services', 'brandVoice', 'annualEvents'];
      for (const field of requiredFields) {
        if (!(field in extractedData)) {
          extractedData[field] = "";
        }
      }
      
      console.log('✅ Successfully parsed extracted data');
      
    } catch (parseError) {
      console.error('❌ Error parsing AI response:', parseError);
      extractedData = {
        businessName: "",
        aboutBusiness: "Business information extracted from website",
        location: "",
        services: "",
        brandVoice: "",
        annualEvents: ""
      };
    }

    // Override AI location with structured extraction if we have it
    if (locationResult.location_info) {
      extractedData.location = locationResult.location_info;
    }

    console.log('🎉 Analysis completed using:', extractionMethod);

    return new Response(JSON.stringify({ 
      extractedData,
      extractionMethod,
      brandingData,
      // New structured location data
      locationExtraction: {
        postal_code: locationResult.postal_code,
        city: locationResult.city,
        state_province: locationResult.state_province,
        country: locationResult.country,
        source: locationResult.source,
        confidence: locationResult.confidence,
        snippet: locationResult.snippet,
        candidates: locationResult.candidates,
        requires_confirmation: locationResult.confidence === 'low' || locationResult.candidates.length > 1
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('💥 Error in analyze-website function:', error);
    
    return new Response(JSON.stringify({ 
      error: error.message || 'Failed to analyze website',
      type: 'server_error',
      details: 'An unexpected error occurred during website analysis.'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
