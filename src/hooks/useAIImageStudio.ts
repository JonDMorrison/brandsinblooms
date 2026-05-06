import {
  useAIImageStudioContext,
  type AIImageStudioContextValue,
} from "@/providers/AIImageStudioProvider";

export function useAIImageStudio(): AIImageStudioContextValue {
  return useAIImageStudioContext();
}
