
import { ContentTypeCard } from "./ContentTypeCard";
import { Instagram, Facebook, Mail, BookOpen, Video } from "lucide-react";

interface ContentType {
  id: string;
  name: string;
  icon: any;
  description: string;
  color: string;
  bgColor: string;
}

interface ContentGenerationTabProps {
  week: any;
  generatedContent: Record<string, string>;
  generatingContent: Record<string, boolean>;
  approvedContent: Record<string, boolean>;
  editingContent: Record<string, boolean>;
  editedContent: Record<string, string>;
  onGenerateContent: (contentType: ContentType) => void;
  onEditContent: (contentType: ContentType) => void;
  onSaveEdit: (contentType: ContentType) => void;
  onCancelEdit: (contentType: ContentType) => void;
  onCopyContent: (contentType: ContentType) => void;
  onApproveContent: (contentType: ContentType) => void;
  onSocialMediaPost: (contentType: ContentType) => void;
  onEditedContentChange: (contentTypeId: string, value: string) => void;
}

export const ContentGenerationTab = ({
  week,
  generatedContent,
  generatingContent,
  approvedContent,
  editingContent,
  editedContent,
  onGenerateContent,
  onEditContent,
  onSaveEdit,
  onCancelEdit,
  onCopyContent,
  onApproveContent,
  onSocialMediaPost,
  onEditedContentChange
}: ContentGenerationTabProps) => {
  const contentTypes: ContentType[] = [
    {
      id: 'instagram',
      name: 'Instagram Post',
      icon: Instagram,
      description: 'Engaging visual post with hashtags',
      color: 'text-pink-700',
      bgColor: 'bg-gradient-to-br from-pink-50 to-purple-50 border-pink-200'
    },
    {
      id: 'facebook',
      name: 'Facebook Post', 
      icon: Facebook,
      description: 'Community-focused social content',
      color: 'text-blue-700',
      bgColor: 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200'
    },
    {
      id: 'email',
      name: 'Email Campaign',
      icon: Mail,
      description: 'Direct marketing email content',
      color: 'text-green-700',
      bgColor: 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200'
    },
    {
      id: 'newsletter',
      name: 'Newsletter',
      icon: BookOpen,
      description: 'Weekly newsletter content',
      color: 'text-purple-700',
      bgColor: 'bg-gradient-to-br from-purple-50 to-violet-50 border-purple-200'
    },
    {
      id: 'video',
      name: 'Video Script',
      icon: Video,
      description: 'Script for video content',
      color: 'text-red-700',
      bgColor: 'bg-gradient-to-br from-red-50 to-orange-50 border-red-200'
    }
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-6">
        {contentTypes.map((contentType) => (
          <ContentTypeCard
            key={contentType.id}
            contentType={contentType}
            week={week}
            generatedContent={generatedContent}
            generatingContent={generatingContent}
            approvedContent={approvedContent}
            editingContent={editingContent}
            editedContent={editedContent}
            onGenerateContent={onGenerateContent}
            onEditContent={onEditContent}
            onSaveEdit={onSaveEdit}
            onCancelEdit={onCancelEdit}
            onCopyContent={onCopyContent}
            onApproveContent={onApproveContent}
            onSocialMediaPost={onSocialMediaPost}
            onEditedContentChange={onEditedContentChange}
          />
        ))}
      </div>
    </div>
  );
};
