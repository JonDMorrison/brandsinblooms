/**
 * Extracts meaningful keywords from raw text for image searching
 * @param raw - The raw text content to extract keywords from
 * @param fallback - Default keyword to use if no valid keywords found
 * @returns Space-separated keywords or fallback string
 */
export const extractKeywords = (raw: string, fallback = 'gardening'): string => {
  if (!raw || typeof raw !== 'string' || raw.trim().length === 0) {
    return fallback;
  }

  // Lowercase and clean the text
  const cleaned = raw
    .toLowerCase()
    .replace(/[#*_`~\[\]()]/g, ' ')  // Remove markdown characters
    .replace(/[^\w\s]/g, ' ')        // Remove punctuation, keep words and spaces
    .replace(/\s+/g, ' ')            // Normalize whitespace
    .trim();

  // Split and filter tokens
  const tokens = cleaned
    .split(/\s+/)
    .filter(token => {
      // Only keep alphabetic tokens with 3+ characters
      return /^[a-z]+$/.test(token) && token.length >= 3;
    })
    .slice(0, 3); // Take first 3 valid tokens

  // Return joined tokens or fallback
  return tokens.length > 0 ? tokens.join(' ') : fallback;
};
