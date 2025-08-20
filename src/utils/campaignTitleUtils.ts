
// Replace current campaignTitleUtils import with the new sanitizer
export { sanitizeCampaignTitle as transformCampaignTitle } from "@/utils/weekNumberSanitizer";
export { sanitizeWeekNumbers as cleanContentFromWeekReferences } from "@/utils/weekNumberSanitizer"; 
export { validateNoWeekNumbers as validateContentCompliance } from "@/utils/weekNumberSanitizer";
