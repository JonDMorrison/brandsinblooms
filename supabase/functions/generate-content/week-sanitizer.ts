/**
 * Universal Week Number Sanitizer for Edge Functions
 * 
 * This ensures NO "Week" followed by numbers appears in any generated content
 */

// Comprehensive patterns to catch all week number references
export const WEEK_NUMBER_PATTERNS = [
  // Basic week patterns
  /Week\s+\d+\s*[-:]\s*/gi,
  /Week\s+\d+(?!\s*\w)/gi, // Week followed by number not followed by letter
  /Week\s+#?\d+/gi,
  /Week\s+\(\d+\)/gi,
  
  // Seasonal focus patterns
  /Seasonal\s+\w+\s+Focus\s*[-:]?\s*Week\s+\d+/gi,
  /Week\s+\d+\s+of\s+\d+/gi,
  /Week\s+\d+\s*[-:]\s*\w+/gi,
  
  // This week patterns
  /This\s+Week\s*\(\s*Week\s+\d+\s*\)/gi,
  /This\s+Week\s*[-:]\s*/gi,
  
  // Weekly patterns
  /Weekly\s*[-:]\s*/gi,
  /Weekly\s+\w+\s*[-:]\s*/gi,
  
  // Week of patterns
  /Week\s+of\s+\w+\s*[-:]\s*/gi,
  /Week\s+of\s+\d{1,2}\/\d{1,2}/gi,
  
  // Common prefixes with week numbers
  /Welcome\s+to\s+Week\s+\d+/gi,
  /Happy\s+Week\s+\d+/gi,
  /In\s+Week\s+\d+/gi,
  /For\s+Week\s+\d+/gi,
  
  // Week ranges
  /Week\s+\d+\s*-\s*\d+/gi,
  /Weeks\s+\d+\s*-\s*\d+/gi,
  
  // Numbered week references in titles
  /^\s*Week\s+\d+\s*[-:]?\s*/gi, // At start of line
  /Week\s+\d+\s*[-:]?\s*$/gi,    // At end of line
];

/**
 * Removes all week number references from content while preserving readability
 */
export function sanitizeWeekNumbers(content: string): string {
  if (!content) return content;

  let sanitized = content;

  // Apply all patterns to remove week number references
  WEEK_NUMBER_PATTERNS.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '');
  });

  // Clean up formatting issues caused by removal
  sanitized = sanitized
    // Remove leading/trailing punctuation left behind
    .replace(/^[-:\s,]+|[-:\s,]+$/gm, '')
    // Remove double spaces
    .replace(/\s{2,}/g, ' ')
    // Remove empty lines created by removal
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    // Trim each line
    .replace(/^\s+|\s+$/gm, '')
    .trim();

  return sanitized;
}

/**
 * Validates content to ensure it contains no week number references
 */
export function validateNoWeekNumbers(content: string): {
  isValid: boolean;
  issues: string[];
  foundPatterns: string[];
} {
  const issues: string[] = [];
  const foundPatterns: string[] = [];

  // Check each pattern
  WEEK_NUMBER_PATTERNS.forEach(pattern => {
    const matches = content.match(pattern);
    if (matches) {
      matches.forEach(match => {
        if (!foundPatterns.includes(match.trim())) {
          foundPatterns.push(match.trim());
          issues.push(`Contains week number reference: "${match.trim()}"`);
        }
      });
    }
  });

  return {
    isValid: issues.length === 0,
    issues,
    foundPatterns
  };
}

/**
 * Adds critical week number restrictions to AI generation prompts
 */
export function addWeekNumberRestrictionsToPrompt(basePrompt: string): string {
  const restrictions = `

🚨 CRITICAL WEEK NUMBER RESTRICTIONS - STRICTLY ENFORCED:
- NEVER use "Week" followed by any number (Week 1, Week 28, etc.)
- NEVER use "Weekly" references or "This Week" language
- NEVER mention week numbers in any context
- NEVER use phrases like "Week of", "This Week", "Happy Week X"
- Focus on seasonal timing instead: "this season", "currently", "right now"
- Use natural time references: "this month", "during spring", "as temperatures rise"
- Replace week numbers with seasonal descriptions

FORBIDDEN EXAMPLES:
❌ "Week 28: Summer Care"
❌ "This Week's Tips" 
❌ "Weekly Garden Focus"
❌ "Welcome to Week 15"

CORRECT ALTERNATIVES:
✅ "Summer Garden Care"
✅ "This Season's Tips"
✅ "Monthly Garden Focus"
✅ "Current Garden Priorities"

VIOLATION = CONTENT REJECTION

`;

  return basePrompt + restrictions;
}

/**
 * Logs week number violations for monitoring
 */
export function logWeekNumberViolation(content: string, context: string): void {
  const validation = validateNoWeekNumbers(content);
  if (!validation.isValid) {
    console.warn(`🚨 WEEK NUMBER VIOLATION in ${context}:`, {
      violations: validation.foundPatterns,
      contentPreview: content.substring(0, 200)
    });
  }
}