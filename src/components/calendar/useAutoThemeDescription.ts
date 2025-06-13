
import { useState, useEffect, useRef } from "react";
import { generateThemeDescription } from "./ThemeDescriptionGenerator";
import { useAuth } from "@/contexts/AuthContext";

interface UseAutoThemeDescriptionProps {
  theme: string;
  currentDescription?: string;
  onDescriptionGenerated: (description: string) => void;
  enabled?: boolean;
}

export const useAutoThemeDescription = ({
  theme,
  currentDescription,
  onDescriptionGenerated,
  enabled = true
}: UseAutoThemeDescriptionProps) => {
  const { user } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastGeneratedTheme, setLastGeneratedTheme] = useState("");
  const debounceRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    // Clear existing debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Don't auto-generate if:
    // - Not enabled
    // - Theme is empty
    // - Theme hasn't changed significantly
    // - Description already exists
    // - Already generating
    if (!enabled ||
        !theme.trim() || 
        theme === lastGeneratedTheme || 
        (currentDescription && currentDescription.trim()) ||
        isGenerating) {
      return;
    }

    // Debounce auto-generation
    debounceRef.current = setTimeout(async () => {
      console.log('Auto-generating description for theme:', theme);
      setIsGenerating(true);
      setLastGeneratedTheme(theme);
      
      try {
        await generateThemeDescription(
          theme, 
          (description) => {
            onDescriptionGenerated(description);
            setIsGenerating(false);
          }, 
          setIsGenerating, 
          user?.id
        );
      } catch (error) {
        console.error('Auto-generation failed:', error);
        setIsGenerating(false);
      }
    }, 1500); // Wait 1.5 seconds after user stops typing

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [theme, user?.id, lastGeneratedTheme, currentDescription, isGenerating, enabled, onDescriptionGenerated]);

  return {
    isGenerating,
    lastGeneratedTheme,
    setLastGeneratedTheme
  };
};
