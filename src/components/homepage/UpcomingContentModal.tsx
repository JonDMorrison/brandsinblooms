
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Instagram, Facebook, Mail, BookOpen, Video, Sparkles, Copy, Check, Edit, Eye, FileText, Save, X } from "lucide-react";
import { toast } from "sonner";
import { generatePersonalizedContent } from "./TaskGenerationUtils";
import { useAuth } from "@/contexts/AuthContext";

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

  const getContentStatus = (contentType: ContentType) => {
    const isGenerating = generatingContent[contentType.id];
    const hasContent = Boolean(generatedContent[contentType.id]);
    const isApproved = approvedContent[contentType.id];

    if (isGenerating) return { status: 'generating', label: 'Generating...', color: 'bg-amber-100 text-amber-800' };
    if (isApproved) return { status: 'approved', label: 'Approved', color: 'bg-green-100 text-green-800' };
    if (hasContent) return { status: 'ready', label: 'Ready for Review', color: 'bg-blue-100 text-blue-800' };
    return { status: 'pending', label: 'Not Generated', color: 'bg-gray-100 text-gray-600' };
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
                {approvedCount}/{contentTypes.length} Approved
              </div>
              <div className="text-sm text-gray-500">
                {generatedCount}/{contentTypes.length} Generated
              </div>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="content" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6 bg-gray-100 p-1 rounded-lg">
            <TabsTrigger 
              value="content" 
              className="flex items-center gap-2 py-3 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md transition-all"
            >
              <Sparkles className="w-4 h-4" />
              Content Generation
            </TabsTrigger>
            <TabsTrigger 
              value="preview" 
              className="flex items-center gap-2 py-3 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md transition-all"
            >
              <Eye className="w-4 h-4" />
              Preview & Edit
            </TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="space-y-6">
            <div className="grid gap-6">
              {contentTypes.map((contentType) => {
                const IconComponent = contentType.icon;
                const isGenerating = generatingContent[contentType.id];
                const hasContent = Boolean(generatedContent[contentType.id]);
                const isEditing = editingContent[contentType.id];
                const status = getContentStatus(contentType);

                return (
                  <Card key={contentType.id} className={`transition-all duration-300 hover:shadow-md ${contentType.bgColor} border-2`}>
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
                            {!isEditing && (
                              <Button
                                onClick={() => handleEditContent(contentType)}
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs"
                              >
                                <Edit className="w-3 h-3 mr-1" />
                                Edit
                              </Button>
                            )}
                          </div>
                          
                          {isEditing ? (
                            <div className="space-y-3">
                              <Textarea
                                value={editedContent[contentType.id] || ''}
                                onChange={(e) => setEditedContent(prev => ({
                                  ...prev,
                                  [contentType.id]: e.target.value
                                }))}
                                className="min-h-[120px] text-sm"
                                placeholder={`Edit your ${contentType.name.toLowerCase()} content...`}
                              />
                              <div className="flex justify-end gap-2">
                                <Button
                                  onClick={() => handleCancelEdit(contentType)}
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 px-3 text-xs"
                                >
                                  <X className="w-3 h-3 mr-1" />
                                  Cancel
                                </Button>
                                <Button
                                  onClick={() => handleSaveEdit(contentType)}
                                  size="sm"
                                  className="h-8 px-3 text-xs bg-green-600 hover:bg-green-700"
                                >
                                  <Save className="w-3 h-3 mr-1" />
                                  Save
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm leading-relaxed text-gray-700">
                              {generatedContent[contentType.id].length > 150 
                                ? generatedContent[contentType.id].substring(0, 150) + '...'
                                : generatedContent[contentType.id]
                              }
                            </p>
                          )}
                        </div>
                      )}
                      
                      <div className="space-y-3">
                        <Button
                          onClick={() => handleGenerateContent(contentType)}
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

                        {hasContent && !isEditing && (
                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              onClick={() => handleCopyContent(contentType)}
                              variant="outline"
                              size="sm"
                              className="h-10 transition-all duration-200"
                            >
                              <Copy className="w-3 h-3 mr-1" />
                              Copy
                            </Button>
                            <Button
                              onClick={() => handleApproveContent(contentType)}
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
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="preview" className="space-y-6">
            {contentTypes.map((contentType) => {
              const content = generatedContent[contentType.id];
              const IconComponent = contentType.icon;
              const status = getContentStatus(contentType);
              const isEditing = editingContent[contentType.id];
              
              if (!content) return null;

              return (
                <Card key={contentType.id} className="overflow-hidden shadow-sm border-2">
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
                            onClick={() => handleEditContent(contentType)}
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
                          onChange={(e) => setEditedContent(prev => ({
                            ...prev,
                            [contentType.id]: e.target.value
                          }))}
                          className="min-h-[200px] text-sm leading-relaxed"
                          placeholder={`Edit your ${contentType.name.toLowerCase()} content...`}
                        />
                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleCancelEdit(contentType)}
                            variant="ghost"
                            size="sm"
                            className="transition-all duration-200"
                          >
                            <X className="w-4 h-4 mr-2" />
                            Cancel
                          </Button>
                          <Button
                            onClick={() => handleSaveEdit(contentType)}
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
                            onClick={() => handleCopyContent(contentType)}
                            variant="outline"
                            size="sm"
                            className="transition-all duration-200"
                          >
                            <Copy className="w-4 h-4 mr-2" />
                            Copy Content
                          </Button>
                          <Button
                            onClick={() => handleApproveContent(contentType)}
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
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
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
          </TabsContent>
        </Tabs>

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
