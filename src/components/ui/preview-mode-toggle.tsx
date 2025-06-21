
import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { DevPreviewBadge } from '@/components/ui/dev-preview-badge';
import { usePreviewMode } from '@/contexts/PreviewModeContext';
import { Eye, EyeOff } from 'lucide-react';

export const PreviewModeToggle = () => {
  const { isPreviewMode, togglePreviewMode } = usePreviewMode();

  return (
    <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="flex items-center gap-2">
        {isPreviewMode ? (
          <Eye className="w-4 h-4 text-blue-600" />
        ) : (
          <EyeOff className="w-4 h-4 text-gray-500" />
        )}
        <Label htmlFor="preview-mode" className="text-sm font-medium cursor-pointer">
          Preview Mode
        </Label>
      </div>
      
      <Switch
        id="preview-mode"
        checked={isPreviewMode}
        onCheckedChange={togglePreviewMode}
      />
      
      {isPreviewMode && (
        <DevPreviewBadge show={true} size="sm" />
      )}
      
      <p className="text-xs text-gray-600 ml-2">
        {isPreviewMode 
          ? "Showing sample content to preview the app experience"
          : "Toggle to see sample content without generating actual content"
        }
      </p>
    </div>
  );
};
