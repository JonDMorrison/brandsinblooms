
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { generatePersonalizedContent } from "./TaskGenerationUtils";
import { useAuth } from "@/contexts/AuthContext";
import { postToFacebook, postToInstagram } from "@/utils/socialMediaUtils";
import { ContentGenerationTab } from "./upcoming-content/ContentGenerationTab";

interface UpcomingContentModalProps {
  week: any;
  isOpen: boolean;
  onClose: () => void;
  onTaskUpdate?: () => void;
}

interface ContentType {
  id: string;
  name: string;
  icon: any;
  description: string;
  color: string;
  bgColor: string;
}

export const UpcomingContentModal = ({ week, isOpen, onClose, onTaskUpdate }: UpcomingContentModalProps) => {
  const { user } = useAuth();
  const [generatedContent, setGeneratedContent] = useState<Record<string, string>>({});
  const [generatingContent, setGeneratingContent] = useState<Record<string, boolean>>({});
  const [approvedContent, setApprovedContent] = useState<Record<string, boolean>>({});
  const [editingContent, setEditingContent] = useState<Record<string, boolean>>({});
  const [editedContent, setEditedContent] = useState<Record<string, string>>({});

  const handleGenerateContent = async (contentType: ContentType) => {
    if (!week || !user) return;
    
    setGeneratingContent(prev => ({ ...prev, [contentType.id]: true }));
    
    try {
      console.log(`Generating ${contentType.name} for theme: ${week.theme}`);
      
      const content = await generatePersonalizedContent(
        contentType.id,
        week.theme,
        user.id
      );
      
      console.log(`Generated content for ${contentType.name}:`, content);
      
      setGeneratedContent(prev => ({ 
        ...prev, 
        [contentType.id]: content 
      }));
      
      toast.success(`${contentType.name} content generated successfully!`);
    } catch (error) {
      console.error('Error generating content:', error);
      toast.error(`Failed to generate ${contentType.name} content. Please try again.`);
    } finally {
      setGeneratingContent(prev => ({ ...prev, [contentType.id]: false }));
    }
  };

  const handleEditContent = (contentType: ContentType) => {
    setEditingContent(prev => ({ ...prev, [contentType.id]: true }));
    setEditedContent(prev => ({
      ...prev,
      [contentType.id]: generatedContent[contentType.id] || ''
    }));
  };

  const handleSaveEdit = (contentType: ContentType) => {
    const newContent = editedContent[contentType.id];
    if (newContent) {
      setGeneratedContent(prev => ({
        ...prev,
        [contentType.id]: newContent
      }));
      setEditingContent(prev => ({ ...prev, [contentType.id]: false }));
      toast.success(`${contentType.name} content updated!`);
    }
  };

  const handleCancelEdit = (contentType: ContentType) => {
    setEditingContent(prev => ({ ...prev, [contentType.id]: false }));
    setEditedContent(prev => ({
      ...prev,
      [contentType.id]: generatedContent[contentType.id] || ''
    }));
  };

  const handleCopyContent = (contentType: ContentType) => {
    const content = generatedContent[contentType.id];
    if (content) {
      navigator.clipboard.writeText(content);
      toast.success(`${contentType.name} copied to clipboard!`);
    }
  };

  const handleApproveContent = (contentType: ContentType) => {
    setApprovedContent(prev => ({ ...prev, [contentType.id]: true }));
    toast.success(`${contentType.name} approved!`);
  };

  const handleSocialMediaPost = (contentType: ContentType) => {
    const content = generatedContent[contentType.id];
    if (!content) return;

    if (contentType.id === 'facebook') {
      postToFacebook(content);
    } else if (contentType.id === 'instagram') {
      postToInstagram(content);
    }
  };

  const handleEditedContentChange = (contentTypeId: string, value: string) => {
    setEditedContent(prev => ({
      ...prev,
      [contentTypeId]: value
    }));
  };

  if (!week) return null;

  const approvedCount = Object.values(approvedContent).filter(Boolean).length;
  const generatedCount = Object.keys(generatedContent).length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-4 pb-6 border-b">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 px-3 py-1">
                  Week {week.weekNumber}
                </Badge>
                <DialogTitle className="text-2xl font-bold">{week.theme}</DialogTitle>
              </div>
              <p className="text-gray-600 text-lg">
                Week of {week.weekStart.toLocaleDateString()} • {week.description}
              </p>
            </div>
            <div className="text-right space-y-1">
              <div className="text-sm text-gray-500">Progress</div>
              <div className="text-lg font-semibold text-gray-900">
                {approvedCount}/5 Approved
              </div>
              <div className="text-sm text-gray-500">
                {generatedCount}/5 Generated
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          <ContentGenerationTab
            week={week}
            generatedContent={generatedContent}
            generatingContent={generatingContent}
            approvedContent={approvedContent}
            editingContent={editingContent}
            editedContent={editedContent}
            onGenerateContent={handleGenerateContent}
            onEditContent={handleEditContent}
            onSaveEdit={handleSaveEdit}
            onCancelEdit={handleCancelEdit}
            onCopyContent={handleCopyContent}
            onApproveContent={handleApproveContent}
            onSocialMediaPost={handleSocialMediaPost}
            onEditedContentChange={handleEditedContentChange}
          />
        </div>

        <div className="flex justify-between items-center pt-6 border-t">
          <div className="text-sm text-gray-500">
            {approvedCount > 0 && (
              <span className="text-green-600 font-medium">
                {approvedCount} content piece{approvedCount !== 1 ? 's' : ''} approved
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="transition-all duration-200">
              Close
            </Button>
            <Button onClick={onClose} className="bg-green-600 hover:bg-green-700 transition-all duration-200">
              Save & Continue
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
