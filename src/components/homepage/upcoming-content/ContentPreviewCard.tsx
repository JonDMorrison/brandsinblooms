
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Copy, Check, Edit, Save, X, Instagram, Facebook } from "lucide-react";

interface ContentType {
  id: string;
  name: string;
  icon: any;
  description: string;
  color: string;
  bgColor: string;
}

interface ContentPreviewCardProps {
  contentType: ContentType;
  content: string;
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

export const ContentPreviewCard = ({
  contentType,
  content,
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
}: ContentPreviewCardProps) => {
  const IconComponent = contentType.icon;
  const isEditing = editingContent[contentType.id];
  const isApproved = approvedContent[contentType.id];

  const getContentStatus = () => {
    if (isApproved) return { status: 'approved', label: 'Approved', color: 'bg-green-100 text-green-800' };
    return { status: 'ready', label: 'Ready for Review', color: 'bg-blue-100 text-blue-800' };
  };

  const status = getContentStatus();

  return (
    <Card className="overflow-hidden shadow-sm border-2">
      <CardHeader className="bg-gray-50 border-b">
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
          <div className="flex items-center gap-3">
            <Badge className={`${status.color} px-3 py-1`}>
              {status.label}
            </Badge>
            {!isEditing && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => onEditContent(contentType)}
                className="transition-all duration-200"
              >
                <Edit className="w-4 h-4 mr-1" />
                Edit
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {isEditing ? (
          <div className="space-y-4">
            <Textarea
              value={editedContent[contentType.id] || ''}
              onChange={(e) => onEditedContentChange(contentType.id, e.target.value)}
              className="min-h-[200px] text-sm leading-relaxed"
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
            <div className="bg-gray-50 p-6 rounded-lg border">
              <p className="text-sm leading-relaxed whitespace-pre-wrap font-medium text-gray-800">
                {content}
              </p>
            </div>
            <div className="flex gap-2 mt-4">
              <Button
                onClick={() => onCopyContent(contentType)}
                variant="outline"
                size="sm"
                className="transition-all duration-200"
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy Content
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
                      Approve Content
                    </>
                  )}
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
