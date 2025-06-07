
import { Button } from "@/components/ui/button";
import { Edit2, Palette, FileText } from "lucide-react";

interface ThemeDisplayProps {
  currentTheme: string;
  currentDescription?: string;
  onEdit: () => void;
}

export const ThemeDisplay = ({ currentTheme, currentDescription, onEdit }: ThemeDisplayProps) => {
  const handleEditClick = () => {
    console.log('Edit clicked from ThemeDisplay');
    onEdit();
  };

  // Clean up theme text by removing week numbers and similar patterns
  const cleanTheme = (theme: string) => {
    if (!theme) return "No theme set";
    
    return theme
      .replace(/Week\s*\d+[\s:-]*/gi, '') // Remove "Week 1:", "Week 23 -", etc.
      .replace(/\d+\s*week[\s:-]*/gi, '') // Remove "1 week:", "23 week -", etc.
      .replace(/^[\s:-]+|[\s:-]+$/g, '') // Remove leading/trailing spaces, colons, dashes
      .trim();
  };

  const displayTheme = cleanTheme(currentTheme);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 group">
        <Palette className="w-4 h-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-700">Content Theme:</span>
        <span className="text-lg font-bold text-green-800 flex-1 leading-tight">
          {displayTheme}
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleEditClick}
          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Edit2 className="w-3 h-3" />
        </Button>
      </div>
      
      {currentDescription && (
        <div className="flex items-start gap-2">
          <FileText className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <span className="text-sm font-medium text-gray-700 block mb-1">Content Focus:</span>
            <p className="text-sm text-gray-600 leading-relaxed">
              {currentDescription}
            </p>
          </div>
        </div>
      )}
      
      {!currentDescription && currentTheme && (
        <div className="flex items-start gap-2">
          <FileText className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <span className="text-sm font-medium text-gray-500 block mb-1">Content Focus:</span>
            <div 
              className="text-sm text-gray-400 italic cursor-pointer hover:text-gray-600 transition-colors p-1 rounded hover:bg-gray-50 select-none"
              onClick={handleEditClick}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleEditClick();
                }
              }}
            >
              No content description set. Click here to add one.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
