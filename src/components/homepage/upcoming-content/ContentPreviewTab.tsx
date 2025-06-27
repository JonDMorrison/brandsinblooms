
import { ContentPreviewCard } from "./ContentPreviewCard";
import { Instagram, Facebook, Mail, BookOpen, Video, FileText } from "lucide-react";

interface ContentType {
  id: string;
  name: string;
  icon: any;
  description: string;
  color: string;
  bgColor: string;
}

interface ContentPreviewTabProps {
  generatedContent: Record<string, string>;
  editingContent: Record<string, boolean>;
  editedContent: Record<string, string>;
  approvedContent: Record<string, boolean>;
  onEditContent: (contentType: ContentType) => void;
  onSaveEdit: (contentType: ContentType) => void;
  onCancelEdit: (contentType: ContentType) => void;
  onCopyContent: (contentType: ContentType) => void;
  onApproveContent: (contentType: ContentType) => void;
  onSocialMediaPost: (contentType: ContentType) => void;
  onEditedContentChange: (contentTypeId: string, value: string) => void;
}

export const ContentPreviewTab = ({
  generatedContent,
  editingContent,
  editedContent,
  approvedContent,
  onEditContent,
  onSaveEdit,
  onCancelEdit,
  onCopyContent,
  onApproveContent,
  onSocialMediaPost,
  onEditedContentChange
}: ContentPreviewTabProps) => {
  const contentTypes: ContentType[] = [
    {
      id: 'instagram',
      name: 'Instagram Post',
      icon: Instagram,
      description: 'Engaging visual post with hashtags',
      color: 'text-pink-700',
      bgColor: 'bg-gradient-to-br from-pink-50 to-purple-50 border-gray-200'
    },
    {
      id: 'facebook',
      name: 'Facebook Post', 
      icon: Facebook,
      description: 'Community-focused social content',
      color: 'text-blue-700',
      bgColor: 'bg-gradient-to-br from-blue-50 to-indigo-50 border-gray-200'
    },
    {
      id: 'email',
      name: 'Email Campaign',
      icon: Mail,
      description: 'Direct marketing email content',
      color: 'text-green-700',
      bgColor: 'bg-gradient-to-br from-green-50 to-emerald-50 border-gray-200'
    },
    {
      id: 'newsletter',
      name: 'Newsletter',
      icon: BookOpen,
      description: 'Weekly newsletter content',
      color: 'text-purple-700',
      bgColor: 'bg-gradient-to-br from-purple-50 to-violet-50 border-gray-200'
    },
    {
      id: 'video',
      name: 'Video Script',
      icon: Video,
      description: 'Script for video content',
      color: 'text-[#3E5A6B]',
      bgColor: 'bg-gradient-to-br from-red-50 to-pink-50 border-gray-200'
    }
  ];

  return (
    <div className="space-y-6">
      {contentTypes.map((contentType) => {
        const content = generatedContent[contentType.id];
        
        if (!content) return null;

        return (
          <ContentPreviewCard
            key={contentType.id}
            contentType={contentType}
            content={content}
            editingContent={editingContent}
            editedContent={editedContent}
            approvedContent={approvedContent}
            onEditContent={onEditContent}
            onSaveEdit={onSaveEdit}
            onCancelEdit={onCancelEdit}
            onCopyContent={onCopyContent}
            onApproveContent={onApproveContent}
            onSocialMediaPost={onSocialMediaPost}
            onEditedContentChange={onEditedContentChange}
          />
        );
      })}
      
      {Object.keys(generatedContent).length === 0 && (
        <div className="text-center py-16 text-gray-500">
          <div className="bg-gray-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
            <FileText className="w-10 h-10 opacity-40" />
          </div>
          <p className="font-medium text-lg mb-2">No content generated yet</p>
          <p className="text-sm max-w-md mx-auto">
            Switch to the Content Generation tab to create content for this week's campaign
          </p>
        </div>
      )}
    </div>
  );
};
