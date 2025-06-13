
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ThemeEditor } from "./ThemeEditor";
import { ThemeDisplay } from "./ThemeDisplay";

interface EditableThemeProps {
  campaignId: string;
  currentTheme: string;
  currentDescription?: string;
  weekNumber?: number;
  onThemeUpdate: (newTheme: string, newDescription?: string) => void;
}

export const EditableTheme = ({ 
  campaignId, 
  currentTheme, 
  currentDescription, 
  weekNumber,
  onThemeUpdate 
}: EditableThemeProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTheme, setEditTheme] = useState(currentTheme);
  const [editDescription, setEditDescription] = useState(currentDescription || "");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    if (!editTheme.trim()) {
      toast({
        title: "Error",
        description: "Theme cannot be empty",
        variant: "destructive",
      });
      return;
    }
    
    setIsLoading(true);
    try {
      console.log('EditableTheme: Saving theme for campaign:', campaignId);
      
      const { error } = await supabase
        .from('campaigns')
        .update({ 
          theme: editTheme.trim(),
          description: editDescription.trim()
        })
        .eq('id', campaignId);

      if (error) {
        console.error('EditableTheme: Error updating theme:', error);
        throw new Error(`Failed to update theme: ${error.message}`);
      }

      onThemeUpdate(editTheme.trim(), editDescription.trim());
      setIsEditing(false);
      
      console.log('EditableTheme: Theme updated successfully');
      toast({
        title: "Theme updated",
        description: "Campaign theme and description have been updated successfully",
      });
    } catch (error: any) {
      console.error('EditableTheme: Error in handleSave:', error);
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
        campaignId={campaignId}
        currentTheme={currentTheme}
        editTheme={editTheme}
        editDescription={editDescription}
        isLoading={isLoading}
        weekNumber={weekNumber}
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
      campaignId={campaignId}
      currentTheme={currentTheme}
      currentDescription={currentDescription}
      weekNumber={weekNumber}
      onEdit={() => setIsEditing(true)}
    />
  );
};
