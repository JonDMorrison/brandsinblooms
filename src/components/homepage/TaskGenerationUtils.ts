
// Re-export all functions for backward compatibility
export { 
  generatePersonalizedContent, 
  generateNewsletterContent, 
  generateVideoScript,
  generateCampaignContent
} from "./ContentGenerationServices";

export { 
  getHashtagsForType, 
  getImageIdeaForType 
} from "./ContentMetadataUtils";
