/**
 * SMS Segment Counter
 * 
 * Implements accurate GSM-7 vs UCS-2 encoding detection and segment counting
 * for SMS billing. This must match the backend implementation.
 */

// GSM-7 Basic Character Set (standard 7-bit encoding)
// Characters in this set use 1 character position
const GSM7_BASIC_CHARS = new Set([
  '@', '£', '$', '¥', 'è', 'é', 'ù', 'ì', 'ò', 'Ç', '\n', 'Ø', 'ø', '\r', 'Å', 'å',
  'Δ', '_', 'Φ', 'Γ', 'Λ', 'Ω', 'Π', 'Ψ', 'Σ', 'Θ', 'Ξ', 'Æ', 'æ', 'ß', 'É',
  ' ', '!', '"', '#', '¤', '%', '&', "'", '(', ')', '*', '+', ',', '-', '.', '/',
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', ':', ';', '<', '=', '>', '?',
  '¡', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O',
  'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'Ä', 'Ö', 'Ñ', 'Ü', '§',
  '¿', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o',
  'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', 'ä', 'ö', 'ñ', 'ü', 'à'
]);

// GSM-7 Extended Characters (escape sequence - uses 2 character positions)
const GSM7_EXTENDED_CHARS = new Set([
  '^', '{', '}', '\\', '[', '~', ']', '|', '€'
]);

export type SmsEncoding = 'GSM-7' | 'UCS-2';

export interface SmsSegmentInfo {
  encoding: SmsEncoding;
  length: number;           // Raw character count
  charCount: number;        // GSM-7 equivalent character count (extended chars = 2)
  perSegment: number;       // Characters per segment based on encoding and multipart
  segments: number;         // Number of SMS segments (1..n)
  isMultipart: boolean;     // Whether message spans multiple segments
}

/**
 * Detect if a character is in GSM-7 basic set
 */
function isGsm7Basic(char: string): boolean {
  return GSM7_BASIC_CHARS.has(char);
}

/**
 * Detect if a character is in GSM-7 extended set
 */
function isGsm7Extended(char: string): boolean {
  return GSM7_EXTENDED_CHARS.has(char);
}

/**
 * Detect the encoding required for the message
 */
export function detectEncoding(text: string): SmsEncoding {
  for (const char of text) {
    if (!isGsm7Basic(char) && !isGsm7Extended(char)) {
      return 'UCS-2';
    }
  }
  return 'GSM-7';
}

/**
 * Calculate GSM-7 character count (extended chars count as 2)
 */
export function calculateGsm7CharCount(text: string): number {
  let count = 0;
  for (const char of text) {
    if (isGsm7Extended(char)) {
      count += 2; // Extended characters use escape sequence
    } else {
      count += 1;
    }
  }
  return count;
}

/**
 * Count SMS segments for a given text message
 * 
 * Segment sizes:
 * - GSM-7: 160 chars single, 153 chars per segment multipart
 * - UCS-2: 70 chars single, 67 chars per segment multipart
 */
export function countSmsSegments(text: string): SmsSegmentInfo {
  if (!text || text.length === 0) {
    return {
      encoding: 'GSM-7',
      length: 0,
      charCount: 0,
      perSegment: 160,
      segments: 0,
      isMultipart: false
    };
  }

  const encoding = detectEncoding(text);
  const length = text.length;
  
  if (encoding === 'GSM-7') {
    const charCount = calculateGsm7CharCount(text);
    
    if (charCount <= 160) {
      return {
        encoding,
        length,
        charCount,
        perSegment: 160,
        segments: 1,
        isMultipart: false
      };
    } else {
      // Multipart SMS uses 7 bytes for UDH header, leaving 153 chars per segment
      const segments = Math.ceil(charCount / 153);
      return {
        encoding,
        length,
        charCount,
        perSegment: 153,
        segments,
        isMultipart: true
      };
    }
  } else {
    // UCS-2 encoding
    if (length <= 70) {
      return {
        encoding,
        length,
        charCount: length,
        perSegment: 70,
        segments: 1,
        isMultipart: false
      };
    } else {
      // Multipart UCS-2 uses 6 bytes for UDH, leaving 67 chars per segment
      const segments = Math.ceil(length / 67);
      return {
        encoding,
        length,
        charCount: length,
        perSegment: 67,
        segments,
        isMultipart: true
      };
    }
  }
}

/**
 * Calculate billable units for an SMS
 * 
 * @param text - The message text
 * @param isMms - Whether this is an MMS (has media)
 * @param mmsUnitCost - Cost in units for MMS (default 3)
 */
export function calculateBillableUnits(
  text: string,
  isMms: boolean = false,
  mmsUnitCost: number = 3
): number {
  if (isMms) {
    return mmsUnitCost;
  }
  return countSmsSegments(text).segments;
}

/**
 * Get a human-readable description of the segment info
 */
export function getSegmentDescription(info: SmsSegmentInfo): string {
  if (info.segments === 0) {
    return 'Empty message';
  }
  
  if (info.segments === 1) {
    return `1 segment (${info.encoding})`;
  }
  
  return `${info.segments} segments (${info.encoding}, ${info.charCount} chars)`;
}

/**
 * Check if a message contains characters that require UCS-2
 */
export function hasUnicodeCharacters(text: string): boolean {
  return detectEncoding(text) === 'UCS-2';
}

/**
 * Get characters that are forcing UCS-2 encoding
 */
export function getUnicodeCharacters(text: string): string[] {
  const unicodeChars: string[] = [];
  for (const char of text) {
    if (!isGsm7Basic(char) && !isGsm7Extended(char)) {
      if (!unicodeChars.includes(char)) {
        unicodeChars.push(char);
      }
    }
  }
  return unicodeChars;
}
