
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Copy, Check, Edit, Save, X, Sparkles, Instagram, Facebook } from "lucide-react";

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
  const hasContent = generatedContent[contentType.id];
  const isApproved = approvedContent[contentType.id];
  const isEditing = editingContent[contentType.id];

  const getContentStatus = () => {
    if (isGenerating) return { status: 'generating', label: 'Generating...', color: 'bg-blue-100 text-blue-800' };
    if (isApproved) return { status: 'approved', label: 'Approved', color: 'bg-green-100 text-green-800' };
    if (hasContent) return { status: 'ready', label: 'Ready for Review', color: 'bg-orange-100 text-orange-800' };
    return { status: 'pending', label: 'Pending', color: 'bg-gray-100 text-gray-600' };
  };

  const status = getContentStatus();

  return (
    <Card className={`overflow-hidden transition-all duration-300 ${contentType.bgColor} ${hasContent ? 'shadow-md' : 'shadow-sm'}`}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-lg ${contentType.color} bg-white shadow-sm`}>
              <IconComponent className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">
                {contentType.name}
              </CardTitle>
              <CardDescription className="mt-1">{contentType.description}</CardDescription>
            </div>
          </div>
          <Badge className={`${status.color} px-3 py-1`}>
            {status.label}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {isGenerating && (
          <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600 animate-pulse" />
              <span className="text-sm font-medium text-blue-800">Generating {contentType.name.toLowerCase()}...</span>
            </div>
          </div>
        )}

        {hasContent && !isGenerating && (
          <div className="space-y-4">
            {isEditing ? (
              <div className="space-y-4">
                <Textarea
                  value={editedContent[contentType.id] || generatedContent[contentType.id] || ''}
                  onChange={(e) => onEditedContentChange(contentType.id, e.target.value)}
                  className="min-h-[200px] text-sm leading-relaxed resize-none"
                  placeholder={`Edit your ${contentType.name.toLowerCase()} content...`}
                />
                <div className="flex gap-2">
                  <Button
                    onClick={() => onCancelEdit(contentType)}
                    variant="ghost"
                    size="sm"
                    className="transition-all duration-200"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                  <Button
                    onClick={() => onSaveEdit(contentType)}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 transition-all duration-200"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="bg-white p-6 rounded-lg border-2 border-gray-200 shadow-sm">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap font-medium text-gray-800 min-h-[120px]">
                    {generatedContent[contentType.id]}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => onEditContent(contentType)}
                    variant="outline"
                    size="sm"
                    className="transition-all duration-200"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                  <Button
                    onClick={() => onCopyContent(contentType)}
                    variant="outline"
                    size="sm"
                    className="transition-all duration-200"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy
                  </Button>
                  {(contentType.id === 'facebook' || contentType.id === 'instagram') ? (
                    <Button
                      onClick={() => onSocialMediaPost(contentType)}
                      className="bg-blue-600 hover:bg-blue-700 text-white transition-all duration-200"
                      size="sm"
                    >
                      {contentType.id === 'facebook' ? (
                        <>
                          <Facebook className="w-4 h-4 mr-2" />
                          Post to Facebook
                        </>
                      ) : (
                        <>
                          <Instagram className="w-4 h-4 mr-2" />
                          Post to Instagram
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button
                      onClick={() => onApproveContent(contentType)}
                      variant={status.status === 'approved' ? "default" : "outline"}
                      size="sm"
                      disabled={status.status === 'approved'}
                      className="transition-all duration-200"
                    >
                      {status.status === 'approved' ? (
                        <>
                          <Check className="w-4 h-4 mr-2" />
                          Approved
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4 mr-2" />
                          Approve
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {!hasContent && !isGenerating && !hideGenerateButton && (
          <Button
            onClick={() => onGenerateContent(contentType)}
            className="w-full h-12 font-medium transition-all duration-200"
            size="lg"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Generate {contentType.name}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
