
import { VIDEO_SCENE_PATTERNS, cleanVideoScript } from './contentValidation';

export function cleanVideoContent(content: string): string {
  if (!content) return content;
  
  console.log('🎬 Cleaning video content:', {
    originalLength: content.length,
    hasScenePatterns: VIDEO_SCENE_PATTERNS.some(pattern => pattern.test(content))
  });
  
  // First pass: Remove all scene information
  let cleaned = cleanVideoScript(content);
  
  // Second pass: Additional specific cleaning for video content
  cleaned = cleaned
    // Remove any production timing references
    .replace(/\b\d{1,2}:\d{2}\b/g, '')
    // Remove common video script headers
    .replace(/^(VIDEO SCRIPT|SCRIPT|GARDEN VIDEO).*$/gmi, '')
    // Remove transition words that are script-specific
    .replace(/\b(FADE IN|FADE OUT|CUT TO|DISSOLVE)\b/gi, '')
    // Remove any remaining production notes
    .replace(/\(.*?camera.*?\)/gi, '')
    .replace(/\(.*?shot.*?\)/gi, '')
    // Clean up multiple spaces and line breaks
    .replace(/\s{3,}/g, '  ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  
  console.log('🎬 Video content cleaned:', {
    cleanedLength: cleaned.length,
    removedCharacters: content.length - cleaned.length
  });
  
  return cleaned;
}

export function isVideoScriptContent(content: string): boolean {
  if (!content) return false;
  
  const sceneIndicators = [
    /\[Scene/i,
    /Scene \d+/i,
    /\*Visual:/i,
    /Camera/i,
    /Narrator \(Voiceover\)/i,
    /\*\*Host:\*\*/i,
    /Video Title:/i
  ];
  
  return sceneIndicators.some(pattern => pattern.test(content));
}
