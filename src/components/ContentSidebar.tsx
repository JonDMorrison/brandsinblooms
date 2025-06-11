
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

interface ContentSidebarProps {
  task: any;
  isOpen: boolean;
  onClose: () => void;
  onTaskUpdate?: () => void;
}

export const ContentSidebar = ({ task, isOpen, onClose, onTaskUpdate }: ContentSidebarProps) => {
  const [editedContent, setEditedContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Update editedContent when task changes
  useEffect(() => {
    if (task?.ai_output) {
      setEditedContent(task.ai_output);
      setIsEditing(false); // Reset editing state when task changes
    } else {
      setEditedContent("");
    }
  }, [task]);

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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            <ContentHeader postType={task.post_type} />
          </DialogTitle>
          <DialogDescription>
            {isEditing ? "Edit your content below" : "Review generated content"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <ContentApproval 
            task={task} 
            onTaskUpdate={onTaskUpdate} 
            onClose={onClose} 
          />

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">Scheduled for:</p>
                <Badge variant="outline" className="mb-4">
                  {new Date(task.scheduled_date).toLocaleDateString()}
                </Badge>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-700">Content</h3>
                  {!isEditing ? (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={toggleEditMode}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      Edit Content
                    </Button>
                  ) : null}
                </div>
                
                <ContentEditor
                  content={editedContent}
                  onContentChange={setEditedContent}
                  task={task}
                  isEditing={isEditing}
                />

                {isEditing && (
                  <div className="flex gap-2 mt-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={cancelEditing}
                      className="text-gray-600"
                    >
                      Cancel
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={handleSaveChanges} 
                      disabled={isSaving}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {isSaving ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <ContentMetadata task={task} />
              <QuickCopyActions content={editedContent} />
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t">
            {!isEditing && (
              <>
                <Button 
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  disabled={!editedContent.trim() || task.status === 'generating' || isSaving}
                  onClick={toggleEditMode}
                >
                  Edit Content
                </Button>
                <Button 
                  variant="outline"
                  onClick={onClose}
                  className="px-6"
                >
                  Close
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
