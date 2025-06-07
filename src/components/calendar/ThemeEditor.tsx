
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Check, X } from "lucide-react";
import { generateThemeDescription } from "./ThemeDescriptionGenerator";
import { SmartThemeSelector } from "../theme-generation/SmartThemeSelector";

interface ThemeEditorProps {
  editTheme: string;
  editDescription: string;
  isLoading: boolean;
  weekNumber?: number;
  onThemeChange: (theme: string) => void;
  onDescriptionChange: (description: string) => void;
  onLoadingChange: (isLoading: boolean) => void;
  onSave: () => void;
  onCancel: () => void;
}

export const ThemeEditor = ({
  editTheme,
  editDescription,
  isLoading,
  weekNumber,
  onThemeChange,
  onDescriptionChange,
  onLoadingChange,
  onSave,
  onCancel,
}: ThemeEditorProps) => {
  const handleGenerateDescription = async () => {
    await generateThemeDescription(editTheme, onDescriptionChange, onLoadingChange);
  };

  const handleSmartThemeSelect = (theme: string, description: string) => {
    onThemeChange(theme);
    onDescriptionChange(description);
  };

  const currentMonth = new Date().getMonth() + 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Input
          value={editTheme}
          onChange={(e) => onThemeChange(e.target.value)}
          placeholder="Enter theme..."
          className="h-8 text-sm"
          autoFocus
        />
        <Button
          size="sm"
          variant="outline"
          onClick={handleGenerateDescription}
          disabled={isLoading || !editTheme.trim()}
          className="h-8 px-3 text-xs"
        >
          Generate
        </Button>
      </div>

      {weekNumber && (
        <SmartThemeSelector
          weekNumber={weekNumber}
          currentMonth={currentMonth}
          onThemeSelected={handleSmartThemeSelect}
        />
      )}
      
      <div className="space-y-2">
        <label className="text-xs font-medium text-gray-700">Content Focus Description:</label>
        <Textarea
          value={editDescription}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Two-sentence description of the content focus for this week..."
          className="text-sm min-h-[60px]"
          rows={3}
        />
        <p className="text-xs text-gray-500">
          This description will guide all content creation for this week (newsletter, social media, emails, videos).
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={onSave}
          disabled={isLoading || !editTheme.trim()}
          className="h-8 px-3 bg-green-50 hover:bg-green-100 border-green-200 text-green-700"
        >
          <Check className="w-3 h-3 mr-1" />
          Save
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
          className="h-8 px-3"
        >
          <X className="w-3 h-3 mr-1" />
          Cancel
        </Button>
      </div>
    </div>
  );
};
