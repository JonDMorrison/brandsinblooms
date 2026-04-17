import React, { useEffect, useState } from "react";
import { getCurrentSeasonalTemplate, SeasonalTemplate } from "@/utils/seasonalTemplateService";
import { getCurrentWeekNumber } from "@/utils/dateUtils";
import { X } from "lucide-react";

interface WeeklyThemeCardProps {
  onUseTheme: (title: string, seasonalFocus: string) => void;
}

export const WeeklyThemeCard: React.FC<WeeklyThemeCardProps> = ({ onUseTheme }) => {
  const [template, setTemplate] = useState<SeasonalTemplate | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getCurrentSeasonalTemplate().then((t) => {
      if (mounted) {
        setTemplate(t);
        setLoading(false);
      }
    });
    return () => { mounted = false; };
  }, []);

  if (loading || !template || dismissed) return null;

  const weekNum = getCurrentWeekNumber();
  const firstIdea = template.content_ideas
    ? template.content_ideas.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean)[0] || ""
    : "";

  return (
    <div className="relative flex items-start gap-3 rounded-lg border border-green-200 bg-green-50/60 px-4 py-3 mb-4">
      <span className="text-lg leading-none mt-0.5">🌱</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-green-900">
          Week {weekNum} theme: {template.title}
        </p>
        <p className="text-xs text-green-800 mt-0.5">
          Seasonal focus: {template.seasonal_focus}
        </p>
        {firstIdea && (
          <p className="text-xs text-green-700 mt-0.5 italic">
            Content idea: {firstIdea}
          </p>
        )}
        <button
          type="button"
          onClick={() => onUseTheme(template.title, template.seasonal_focus)}
          className="mt-2 inline-flex items-center rounded-md bg-green-700 px-3 py-1 text-xs font-medium text-white hover:bg-green-800 transition-colors"
        >
          Use this theme
        </button>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="flex-shrink-0 rounded p-0.5 text-green-600 hover:text-green-800 transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};
