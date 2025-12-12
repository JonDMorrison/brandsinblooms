/**
 * SMS Segment Counter (Backend)
 * 
 * Implements accurate GSM-7 vs UCS-2 encoding detection and segment counting
 * for SMS billing. This must match the frontend implementation.
 */

// GSM-7 Basic Character Set (standard 7-bit encoding)
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
  length: number;
  charCount: number;
  perSegment: number;
  segments: number;
  isMultipart: boolean;
}

function isGsm7Basic(char: string): boolean {
  return GSM7_BASIC_CHARS.has(char);
}

function isGsm7Extended(char: string): boolean {
  return GSM7_EXTENDED_CHARS.has(char);
}

export function detectEncoding(text: string): SmsEncoding {
  for (const char of text) {
    if (!isGsm7Basic(char) && !isGsm7Extended(char)) {
      return 'UCS-2';
    }
  }
  return 'GSM-7';
}

export function calculateGsm7CharCount(text: string): number {
  let count = 0;
  for (const char of text) {
    if (isGsm7Extended(char)) {
      count += 2;
    } else {
      count += 1;
    }
  }
  return count;
}

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
