
// Re-export functions from specialized utils files for backward compatibility
export { cleanupDuplicatesForCampaign } from "./CleanupUtils";
export { updateVideoTasksWithNewScript, createMissingTasks } from "./TaskCreationUtils";
export { generateRequiredTasks } from "./RequiredTasksGenerator";

// Export week number sanitization for UI components
export { sanitizeCampaignTitle } from "@/utils/weekNumberSanitizer";
