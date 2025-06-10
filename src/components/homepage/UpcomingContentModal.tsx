
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { ContentGenerationTab } from "./upcoming-content/ContentGenerationTab";
import { SocialMediaPostModal } from "@/components/SocialMediaPostModal";
import { useUpcomingContentModal } from "./upcoming-content/useUpcomingContentModal";
import { UpcomingContentModalHeader } from "./upcoming-content/UpcomingContentModalHeader";
import { UpcomingContentModalFooter } from "./upcoming-content/UpcomingContentModalFooter";

interface UpcomingContentModalProps {
  week: any;
  isOpen: boolean;
  onClose: () => void;
  onTaskUpdate?: () => void;
}

export const UpcomingContentModal = ({ week, isOpen, onClose, onTaskUpdate }: UpcomingContentModalProps) => {
  const {
    generatedContent,
    generatingContent,
    approvedContent,
    editingContent,
    editedContent,
    socialMediaModal,
    handleGenerateContent,
    handleEditContent,
    handleSaveEdit,
    handleCancelEdit,
    handleCopyContent,
    handleApproveContent,
    handleSocialMediaPost,
    handleEditedContentChange,
    closeSocialMediaModal
  } = useUpcomingContentModal(week, onTaskUpdate);

  if (!week) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <UpcomingContentModalHeader 
              week={week}
              approvedContent={approvedContent}
              generatedContent={generatedContent}
            />
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

          <UpcomingContentModalFooter 
            approvedContent={approvedContent}
            onClose={onClose}
          />
        </DialogContent>
      </Dialog>

      <SocialMediaPostModal
        isOpen={socialMediaModal.isOpen}
        onClose={closeSocialMediaModal}
        platform={socialMediaModal.platform!}
        content={socialMediaModal.content}
      />
    </>
  );
};
