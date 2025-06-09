
import { ContentTypeCard } from "./ContentTypeCard";
import { Instagram, Facebook, Mail, BookOpen, Video, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

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

  const handleGenerateAllContent = async () => {
    for (const contentType of contentTypes) {
      if (!generatedContent[contentType.id] && !generatingContent[contentType.id]) {
        onGenerateContent(contentType);
        // Add a small delay between requests to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  };

  const isGeneratingAny = Object.values(generatingContent).some(Boolean);
  const allContentGenerated = contentTypes.every(type => generatedContent[type.id]);

  return (
    <div className="space-y-6">
      <div className="flex justify-center">
        <Button
          onClick={handleGenerateAllContent}
          disabled={isGeneratingAny || allContentGenerated}
          className="w-full max-w-md h-12 font-medium transition-all duration-200 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          size="lg"
        >
          {isGeneratingAny ? (
            <>
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
              Generating All Content...
            </>
          ) : allContentGenerated ? (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              All Content Generated
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Generate All Content
            </>
          )}
        </Button>
      </div>

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
            hideGenerateButton={true}
          />
        ))}
      </div>
    </div>
  );
};
