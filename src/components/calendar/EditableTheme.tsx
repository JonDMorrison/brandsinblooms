
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Edit2, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface EditableThemeProps {
  campaignId: string;
  currentTheme: string;
  onThemeUpdate: (newTheme: string) => void;
}

export const EditableTheme = ({ campaignId, currentTheme, onThemeUpdate }: EditableThemeProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(currentTheme);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    if (!editValue.trim()) return;
    
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('campaigns')
        .update({ theme: editValue.trim() })
        .eq('id', campaignId);

      if (error) throw error;

      onThemeUpdate(editValue.trim());
      setIsEditing(false);
      toast({
        title: "Theme updated",
        description: "Campaign theme has been updated successfully",
      });
    } catch (error: any) {
      console.error('Error updating theme:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update theme",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setEditValue(currentTheme);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <Input
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') handleCancel();
          }}
          placeholder="Enter theme..."
          className="h-8 text-sm"
          autoFocus
        />
        <Button
          size="sm"
          variant="outline"
          onClick={handleSave}
          disabled={isLoading || !editValue.trim()}
          className="h-8 w-8 p-0"
        >
          <Check className="w-3 h-3" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleCancel}
          disabled={isLoading}
          className="h-8 w-8 p-0"
        >
          <X className="w-3 h-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 group">
      <span className="text-sm text-gray-600 flex-1">
        {currentTheme || "No theme set"}
      </span>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setIsEditing(true)}
        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Edit2 className="w-3 h-3" />
      </Button>
    </div>
  );
};
