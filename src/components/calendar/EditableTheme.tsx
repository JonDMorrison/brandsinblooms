
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ThemeEditor } from "./ThemeEditor";
import { ThemeDisplay } from "./ThemeDisplay";

interface EditableThemeProps {
  campaignId: string;
  currentTheme: string;
  currentDescription?: string;
  onThemeUpdate: (newTheme: string, newDescription?: string) => void;
}

export const EditableTheme = ({ campaignId, currentTheme, currentDescription, onThemeUpdate }: EditableThemeProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTheme, setEditTheme] = useState(currentTheme);
  const [editDescription, setEditDescription] = useState(currentDescription || "");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    if (!editTheme.trim()) return;
    
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('campaigns')
        .update({ 
          theme: editTheme.trim(),
          description: editDescription.trim()
        })
        .eq('id', campaignId);

      if (error) throw error;

      onThemeUpdate(editTheme.trim(), editDescription.trim());
      setIsEditing(false);
      toast({
        title: "Theme updated",
        description: "Campaign theme and description have been updated successfully",
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
    setEditTheme(currentTheme);
    setEditDescription(currentDescription || "");
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <ThemeEditor
        editTheme={editTheme}
        editDescription={editDescription}
        isLoading={isLoading}
        onThemeChange={setEditTheme}
        onDescriptionChange={setEditDescription}
        onLoadingChange={setIsLoading}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    );
  }

  return (
    <ThemeDisplay
      currentTheme={currentTheme}
      currentDescription={currentDescription}
      onEdit={() => setIsEditing(true)}
    />
  );
};
