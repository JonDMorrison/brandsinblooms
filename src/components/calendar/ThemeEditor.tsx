
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Check, X, Lightbulb, Sparkles } from "lucide-react";
import { generateThemeDescription } from "./ThemeDescriptionGenerator";
import { SmartThemeSelector } from "../theme-generation/SmartThemeSelector";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

interface ThemeEditorProps {
  campaignId?: string;
  currentTheme: string;
  currentDescription?: string;
  weekNumber?: number;
  onThemeUpdate?: (newTheme: string, newDescription?: string) => void;
  onSave: (theme: string, description?: string) => void;
  onCancel: () => void;
  editTheme?: string;
  editDescription?: string;
  isLoading?: boolean;
  onThemeChange?: (theme: string) => void;
  onDescriptionChange?: (description: string) => void;
  onLoadingChange?: (isLoading: boolean) => void;
}

export const ThemeEditor = ({
  campaignId,
  currentTheme,
  currentDescription,
  weekNumber,
  onThemeUpdate,
  onSave,
  onCancel,
  editTheme: propEditTheme,
  editDescription: propEditDescription,
  isLoading: propIsLoading,
  onThemeChange: propOnThemeChange,
  onDescriptionChange: propOnDescriptionChange,
  onLoadingChange: propOnLoadingChange,
}: ThemeEditorProps) => {
  const { user } = useAuth();
  
  // Use props if provided, otherwise create local state
  const [localEditTheme, setLocalEditTheme] = useState(currentTheme);
  const [localEditDescription, setLocalEditDescription] = useState(currentDescription || "");
  const [localIsLoading, setLocalIsLoading] = useState(false);

  const editTheme = propEditTheme !== undefined ? propEditTheme : localEditTheme;
  const editDescription = propEditDescription !== undefined ? propEditDescription : localEditDescription;
  const isLoading = propIsLoading !== undefined ? propIsLoading : localIsLoading;
  const onThemeChange = propOnThemeChange || setLocalEditTheme;
  const onDescriptionChange = propOnDescriptionChange || setLocalEditDescription;
  const onLoadingChange = propOnLoadingChange || setLocalIsLoading;

  const handleGenerateDescription = async () => {
    await generateThemeDescription(editTheme, onDescriptionChange, onLoadingChange, user?.id);
  };

  const handleSmartThemeSelect = (theme: string, description: string) => {
    onThemeChange(theme);
    onDescriptionChange(description);
  };

  const handleSave = () => {
    if (onThemeUpdate) {
      onThemeUpdate(editTheme.trim(), editDescription.trim());
    } else {
      onSave(editTheme.trim(), editDescription.trim());
    }
  };

  const currentMonth = new Date().getMonth() + 1;

  // Content focus suggestions based on common garden center themes
  const getContentFocusSuggestions = (theme: string) => {
    const lowerTheme = theme.toLowerCase();
    const suggestions = [];

    if (lowerTheme.includes('spring') || lowerTheme.includes('planting')) {
      suggestions.push(
        "Showcase seasonal planting guides and soil preparation tips. Highlight new arrivals and expert planting advice to help customers start their gardens successfully.",
        "Focus on container gardening solutions and indoor plants for customers transitioning from winter. Emphasize fresh starts and garden planning."
      );
    } else if (lowerTheme.includes('summer') || lowerTheme.includes('heat')) {
      suggestions.push(
        "Share heat-resistant plant recommendations and watering strategies. Demonstrate lawn care techniques and showcase drought-tolerant garden solutions.",
        "Focus on pest management and plant health during hot weather. Highlight cooling garden features and shade plant options."
      );
    } else if (lowerTheme.includes('fall') || lowerTheme.includes('autumn')) {
      suggestions.push(
        "Feature fall cleanup services and winter preparation tips. Showcase seasonal decorative plants and harvest-themed displays.",
        "Focus on tree and shrub care for winter readiness. Highlight bulb planting for next spring and fall color plants."
      );
    } else if (lowerTheme.includes('winter') || lowerTheme.includes('holiday')) {
      suggestions.push(
        "Showcase holiday decorating services and winter plant care. Feature indoor gardening solutions and gift ideas for garden lovers.",
        "Focus on houseplant care during winter months. Highlight seasonal arrangements and planning for next year's garden."
      );
    } else {
      suggestions.push(
        "Demonstrate expert techniques and showcase quality products that solve common gardening challenges. Position your team as trusted local experts.",
        "Focus on practical solutions that help customers achieve their gardening goals. Highlight seasonal opportunities and regional expertise."
      );
    }

    return suggestions;
  };

  const suggestions = editTheme ? getContentFocusSuggestions(editTheme) : [];

  return (
    <div className="space-y-4 bg-white">
      <div className="flex items-center gap-2 bg-white">
        <Input
          value={editTheme}
          onChange={(e) => onThemeChange(e.target.value)}
          placeholder="Enter theme..."
          className="h-8 text-sm bg-white border-gray-300"
          autoFocus
        />
        <Button
          size="sm"
          variant="outline"
          onClick={handleGenerateDescription}
          disabled={isLoading || !editTheme.trim()}
          className="h-8 px-3 text-xs bg-white hover:bg-gray-100 border-gray-300"
        >
          {isLoading ? (
            <Sparkles className="w-3 h-3 animate-spin" />
          ) : (
            <Sparkles className="w-3 h-3" />
          )}
          Generate
        </Button>
      </div>

      {weekNumber && (
        <div className="bg-white">
          <SmartThemeSelector
            weekNumber={weekNumber}
            currentMonth={currentMonth}
            onThemeSelected={handleSmartThemeSelect}
          />
        </div>
      )}
      
      <div className="space-y-3 bg-white">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-700">Content Focus Description:</label>
          <Badge variant="outline" className="text-xs">
            <Lightbulb className="w-3 h-3 mr-1" />
            Guides AI Generation
          </Badge>
        </div>
        
        <Textarea
          value={editDescription}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Describe what your content should focus on this week. Be specific about goals, audience needs, and key messages..."
          className="text-sm min-h-[80px] bg-white border-gray-300"
          rows={4}
        />
        
        {/* Content Focus Suggestions */}
        {suggestions.length > 0 && !editDescription && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-blue-700 flex items-center gap-1">
              <Lightbulb className="w-3 h-3" />
              Quick Focus Ideas:
            </p>
            <div className="space-y-2">
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => onDescriptionChange(suggestion)}
                  className="text-left text-xs text-gray-600 p-2 rounded border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors w-full"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs text-blue-800 leading-relaxed">
            <strong>Why this matters:</strong> This description guides AI to create focused, strategic content across all platforms (social media, email, newsletter, video). 
            The more specific you are about customer needs and business goals, the better your generated content will be.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 bg-white">
        <Button
          size="sm"
          variant="outline"
          onClick={handleSave}
          disabled={isLoading || !editTheme.trim()}
          className="h-8 px-3 bg-white hover:bg-green-100 border-green-200 text-green-700"
        >
          <Check className="w-3 h-3 mr-1" />
          Save
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
          className="h-8 px-3 bg-white hover:bg-gray-100 border-gray-300"
        >
          <X className="w-3 h-3 mr-1" />
          Cancel
        </Button>
      </div>
    </div>
  );
};
