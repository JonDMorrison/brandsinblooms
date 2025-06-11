import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useState, useEffect } from "react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ContentEditor } from "./content-sidebar/ContentEditor";
import { ContentMetadata } from "./content-sidebar/ContentMetadata";
import { QuickCopyActions } from "./content-sidebar/QuickCopyActions";
import { ContentApproval } from "./content-sidebar/ContentApproval";
import { ContentHeader } from "./content-sidebar/ContentHeader";
import { Edit, Save, X } from "lucide-react";

interface ContentSidebarProps {
  task: any;
  isOpen: boolean;
  onClose: () => void;
  onTaskUpdate?: () => void;
  initialEditMode?: boolean;
}

export const ContentSidebar = ({ task, isOpen, onClose, onTaskUpdate, initialEditMode = false }: ContentSidebarProps) => {
  const [editedContent, setEditedContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(initialEditMode);

  // Update editedContent when task changes
  useEffect(() => {
    if (task?.ai_output) {
      setEditedContent(task.ai_output);
    } else {
      setEditedContent("");
    }
  }, [task]);

  // Set initial edit mode when sidebar opens
  useEffect(() => {
    if (isOpen && initialEditMode) {
      setIsEditing(true);
    }
  }, [isOpen, initialEditMode]);

  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('content_tasks')
        .update({ ai_output: editedContent })
        .eq('id', task.id);

      if (error) {
        console.error('Error saving content:', error);
        toast({
          title: "Error",
          description: "Failed to save content. Please try again.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Content Saved! ✅",
          description: "Your changes have been saved successfully.",
        });
        setIsEditing(false); // Exit editing mode after save
        if (onTaskUpdate) onTaskUpdate();
      }
    } catch (error) {
      console.error('Error saving content:', error);
      toast({
        title: "Error",
        description: "Failed to save content. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleEditMode = () => {
    setIsEditing(!isEditing);
  };

  const cancelEditing = () => {
    if (task?.ai_output) {
      setEditedContent(task.ai_output);
    }
    setIsEditing(false);
  };

  if (!task) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>
              <ContentHeader postType={task.post_type} />
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {new Date(task.scheduled_date).toLocaleDateString()}
              </Badge>
              {!isEditing ? (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={toggleEditMode}
                  className="text-blue-600 hover:text-blue-700"
                >
                  <Edit className="w-4 h-4 mr-1" />
                  Edit
                </Button>
              ) : (
                <div className="flex gap-1">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={cancelEditing}
                    className="text-gray-600"
                  >
                    <X className="w-4 h-4 mr-1" />
                    Cancel
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={handleSaveChanges} 
                    disabled={isSaving}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Save className="w-4 h-4 mr-1" />
                    {isSaving ? "Saving..." : "Save"}
                  </Button>
                </div>
              )}
            </div>
          </div>
          <DialogDescription>
            {isEditing ? "Edit your content below" : "Review and manage your content"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <ContentApproval 
            task={task} 
            onTaskUpdate={onTaskUpdate} 
            onClose={onClose} 
          />

          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <ContentEditor
                content={editedContent}
                onContentChange={setEditedContent}
                task={task}
                isEditing={isEditing}
              />
            </div>

            <div className="space-y-4">
              <ContentMetadata task={task} />
              <QuickCopyActions content={editedContent} />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
