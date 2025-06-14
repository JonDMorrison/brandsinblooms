import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Edit2, Save, X, Lightbulb, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ThemeDisplay } from "./ThemeDisplay";

interface EditableThemeProps {
  campaignId: string;
  currentTheme: string;
  currentDescription?: string;
  onThemeUpdate: (newTheme: string, newDescription?: string) => void;
  hideLabel?: boolean;
}

export const EditableTheme = ({ 
  campaignId, 
  currentTheme, 
  currentDescription, 
  onThemeUpdate,
  hideLabel = false
}: EditableThemeProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTheme, setEditTheme] = useState(currentTheme);
  const [editDescription, setEditDescription] = useState(currentDescription || "");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!campaignId) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('campaigns')
        .update({ theme: editTheme, description: editDescription })
        .eq('id', campaignId);

      if (error) {
        console.error("Error updating theme:", error);
        toast.error("Failed to update theme. Please try again.");
        return;
      }

      onThemeUpdate(editTheme, editDescription);
      toast.success("Theme updated successfully!");
      setIsEditing(false);
    } catch (error) {
      console.error("Error during theme update:", error);
      toast.error("Unexpected error occurred. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditTheme(currentTheme);
    setEditDescription(currentDescription || "");
    setIsEditing(false);
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  if (isEditing) {
    return (
      <Card className="border border-blue-200 bg-blue-50/50">
        <CardContent className="p-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="theme-input" className="text-sm font-medium text-gray-900">
              Theme
            </Label>
            <Input
              id="theme-input"
              value={editTheme}
              onChange={(e) => setEditTheme(e.target.value)}
              placeholder="Enter your campaign theme..."
              className="bg-white"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description-input" className="text-sm font-medium text-gray-900">
              Description (Optional)
            </Label>
            <Textarea
              id="description-input"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Add more details about your theme..."
              className="bg-white min-h-20"
            />
          </div>
          
          <div className="flex items-center gap-2 pt-2">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving || !editTheme.trim()}
              className="bg-green-600 hover:bg-green-700"
            >
              {isSaving ? (
                <>
                  <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-3 h-3 mr-2" />
                  Save
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancel}
              disabled={isSaving}
            >
              <X className="w-3 h-3 mr-2" />
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!hideLabel) {
    return (
      <ThemeDisplay
        campaignId={campaignId}
        currentTheme={currentTheme}
        currentDescription={currentDescription}
        onEdit={handleEdit}
      />
    );
  }

  // Simplified display when hideLabel is true
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-gray-800 font-medium mb-3">{currentTheme}</p>
          
          {currentDescription && (
            <p className="text-gray-600 text-sm leading-relaxed">{currentDescription}</p>
          )}
        </div>
        
        <Button
          size="sm"
          variant="outline"
          onClick={handleEdit}
          className="flex items-center gap-2 ml-4"
        >
          <Edit2 className="w-4 h-4" />
          Edit
        </Button>
      </div>
    </div>
  );
};
