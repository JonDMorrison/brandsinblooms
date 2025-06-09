
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Copy, Check, Edit, Save, X, Sparkles, Instagram, Facebook } from "lucide-react";
import { toast } from "sonner";
import { generatePersonalizedContent } from "../TaskGenerationUtils";
import { useAuth } from "@/contexts/AuthContext";
import { postToFacebook, postToInstagram } from "@/utils/socialMediaUtils";

interface ContentType {
  id: string;
  name: string;
  icon: any;
  description: string;
  color: string;
  bgColor: string;
}

interface ContentTypeCardProps {
  contentType: ContentType;
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
  hideGenerateButton?: boolean;
}

export const ContentTypeCard = ({
  contentType,
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
  onEditedContentChange,
  hideGenerateButton = false
}: ContentTypeCardProps) => {
  const IconComponent = contentType.icon;
  const isGenerating = generatingContent[contentType.id];
  const hasContent = Boolean(generatedContent[contentType.id]);
  const isEditing = editingContent[contentType.id];

  const getContentStatus = () => {
    const isApproved = approvedContent[contentType.id];

    if (isGenerating) return { status: 'generating', label: 'Generating...', color: 'bg-amber-100 text-amber-800' };
    if (isApproved) return { status: 'approved', label: 'Approved', color: 'bg-green-100 text-green-800' };
    if (hasContent) return { status: 'ready', label: 'Ready for Review', color: 'bg-blue-100 text-blue-800' };
    return { status: 'pending', label: 'Not Generated', color: 'bg-gray-100 text-gray-600' };
  };

  const status = getContentStatus();

  return (
    <Card className={`transition-all duration-300 hover:shadow-md ${contentType.bgColor} border-2`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-lg bg-white/80 backdrop-blur-sm ${contentType.color}`}>
              <IconComponent className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">
                {contentType.name}
              </CardTitle>
              <CardDescription className="text-sm text-gray-600 mt-1">
                {contentType.description}
              </CardDescription>
            </div>
          </div>
          <Badge className={`text-xs font-medium px-3 py-1 ${status.color}`}>
            {status.label}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {hasContent && (
          <div className="bg-white/90 backdrop-blur-sm p-4 rounded-lg border border-white/60">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-500 font-medium">Generated Content:</p>
              <Button
                onClick={() => onEditContent(contentType)}
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
              >
                <Edit className="w-3 h-3 mr-1" />
                Edit
              </Button>
            </div>
            
            <p className="text-sm leading-relaxed text-gray-700">
              {generatedContent[contentType.id].length > 150 
                ? generatedContent[contentType.id].substring(0, 150) + '...'
                : generatedContent[contentType.id]
              }
            </p>
          </div>
        )}
        
        <div className="space-y-3">
          {!hideGenerateButton && (
            <Button
              onClick={() => onGenerateContent(contentType)}
              disabled={isGenerating}
              className="w-full h-11 font-medium transition-all duration-200"
              size="sm"
              variant={hasContent ? "outline" : "default"}
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                  Generating...
                </>
              ) : hasContent ? (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Regenerate Content
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Content
                </>
              )}
            </Button>
          )}

          {hasContent && (
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={() => onCopyContent(contentType)}
                variant="outline"
                size="sm"
                className="h-10 transition-all duration-200"
              >
                <Copy className="w-3 h-3 mr-1" />
                Copy
              </Button>
              {(contentType.id === 'facebook' || contentType.id === 'instagram') ? (
                <Button
                  onClick={() => onSocialMediaPost(contentType)}
                  variant="outline"
                  size="sm"
                  className="h-10 transition-all duration-200 bg-blue-50 hover:bg-blue-100"
                >
                  {contentType.id === 'facebook' ? (
                    <>
                      <Facebook className="w-3 h-3 mr-1" />
                      Post
                    </>
                  ) : (
                    <>
                      <Instagram className="w-3 h-3 mr-1" />
                      Post
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={() => onApproveContent(contentType)}
                  variant={status.status === 'approved' ? "default" : "outline"}
                  size="sm"
                  className="h-10 transition-all duration-200"
                  disabled={status.status === 'approved'}
                >
                  {status.status === 'approved' ? (
                    <>
                      <Check className="w-3 h-3 mr-1" />
                      Approved
                    </>
                  ) : (
                    <>
                      <Check className="w-3 h-3 mr-1" />
                      Approve
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
