/**
 * Strips markdown formatting from social media content
 * Facebook and Instagram do not render markdown - they display it as literal text
 * This utility removes markdown syntax to ensure clean, professional posts
 */
export function stripMarkdownForSocial(text: string): string {
  if (!text) return text;
  
  return text
    // Bold: **text** or __text__ -> text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    // Italic: *text* or _text_ -> text (but preserve underscores in URLs)
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/(?<!https?:\/\/[^\s]*)_([^_]+)_/g, '$1')
    // Strikethrough: ~~text~~ -> text
    .replace(/~~([^~]+)~~/g, '$1')
    // Code: `text` -> text
    .replace(/`([^`]+)`/g, '$1')
    // Links: [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Headers: ## text -> text
    .replace(/^#{1,6}\s+/gm, '')
    // Trim extra whitespace
    .trim();
}
