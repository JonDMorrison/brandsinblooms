/**
 * Utility functions for generating and handling campaign slugs
 */

export const generateCampaignSlug = (title: string, contentTaskId: string): string => {
  // Clean the title to create a URL-friendly slug
  const cleanTitle = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Remove multiple consecutive hyphens
    .trim();

  // Take first 6 characters of contentTaskId for uniqueness
  const uniqueId = contentTaskId.substring(0, 6);
  
  // Combine title and unique ID
  return `${cleanTitle}-${uniqueId}`.replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
};

export const extractContentTaskIdFromSlug = (slug: string): string | null => {
  // Extract the last 6 characters as the contentTaskId prefix
  const parts = slug.split('-');
  const lastPart = parts[parts.length - 1];
  
  if (lastPart && lastPart.length === 6) {
    return lastPart;
  }
  
  return null;
};

export const validateCampaignSlug = (slug: string): boolean => {
  // Basic validation: slug should contain alphanumeric characters and hyphens
  const slugPattern = /^[a-z0-9-]+$/;
  return slugPattern.test(slug) && slug.length > 6; // At least 6 chars for the ID part
};