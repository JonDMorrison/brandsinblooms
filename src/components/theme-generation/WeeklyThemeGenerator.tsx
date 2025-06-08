
import { useThemeGeneration } from "./useThemeGeneration";
import { ThemeGenerationSuccess } from "./ThemeGenerationSuccess";
import { ThemeGenerationButton } from "./ThemeGenerationButton";

interface WeeklyTheme {
  week: number;
  title: string;
  description: string;
  content_ideas: string[];
}

interface WeeklyThemeGeneratorProps {
  onThemesGenerated?: (themes: WeeklyTheme[]) => void;
}

export const WeeklyThemeGenerator = ({ onThemesGenerated }: WeeklyThemeGeneratorProps) => {
  const { 
    loading, 
    generatedThemes, 
    networkError, 
    generateWeeklyThemes, 
    saveToCampaigns 
  } = useThemeGeneration(onThemesGenerated);

  // Show compact view when themes are generated
  if (generatedThemes.length > 0) {
    return (
      <ThemeGenerationSuccess
        themes={generatedThemes}
        loading={loading}
        onSaveToCampaigns={saveToCampaigns}
      />
    );
  }

  return (
    <ThemeGenerationButton
      loading={loading}
      networkError={networkError}
      onGenerate={generateWeeklyThemes}
    />
  );
};
