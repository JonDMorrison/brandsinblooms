
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Instagram, Facebook, Mail, BookOpen, Video, Sparkles, Copy, Check, Edit } from "lucide-react";
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
}

export const UpcomingContentModal = ({ week, isOpen, onClose, onTaskUpdate }: UpcomingContentModalProps) => {
  const { user } = useAuth();
  const [generatedContent, setGeneratedContent] = useState<Record<string, string>>({});
  const [generatingContent, setGeneratingContent] = useState<Record<string, boolean>>({});
  const [approvedContent, setApprovedContent] = useState<Record<string, boolean>>({});

  const contentTypes: ContentType[] = [
    {
      id: 'instagram',
      name: 'Instagram Post',
      icon: Instagram,
      description: 'Engaging visual post with hashtags',
      color: 'bg-pink-100 text-pink-800 border-pink-200'
    },
    {
      id: 'facebook',
      name: 'Facebook Post', 
      icon: Facebook,
      description: 'Community-focused social content',
      color: 'bg-blue-100 text-blue-800 border-blue-200'
    },
    {
      id: 'email',
      name: 'Email Campaign',
      icon: Mail,
      description: 'Direct marketing email content',
      color: 'bg-green-100 text-green-800 border-green-200'
    },
    {
      id: 'newsletter',
      name: 'Newsletter',
      icon: BookOpen,
      description: 'Weekly newsletter content',
      color: 'bg-purple-100 text-purple-800 border-purple-200'
    },
    {
      id: 'video',
      name: 'Video Script',
      icon: Video,
      description: 'Script for video content',
      color: 'bg-red-100 text-red-800 border-red-200'
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

  if (!week) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              Week {week.weekNumber}
            </Badge>
            {week.theme}
          </DialogTitle>
          <p className="text-sm text-gray-600">
            Week of {week.weekStart.toLocaleDateString()} • {week.description}
          </p>
        </DialogHeader>

        <Tabs defaultValue="content" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="content">Content Generation</TabsTrigger>
            <TabsTrigger value="preview">Preview & Edit</TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="space-y-4">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {contentTypes.map((contentType) => {
                const IconComponent = contentType.icon;
                const isGenerating = generatingContent[contentType.id];
                const hasContent = Boolean(generatedContent[contentType.id]);
                const isApproved = approvedContent[contentType.id];

                return (
                  <Card key={contentType.id} className="relative">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <IconComponent className="w-4 h-4" />
                        {contentType.name}
                        {isApproved && (
                          <Badge className="bg-green-100 text-green-800 text-xs">
                            <Check className="w-3 h-3 mr-1" />
                            Approved
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {contentType.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {hasContent && (
                        <div className="bg-gray-50 p-3 rounded-md mb-3">
                          <p className="text-xs text-gray-600 mb-1">Generated Content:</p>
                          <p className="text-sm line-clamp-3">{generatedContent[contentType.id]}</p>
                        </div>
                      )}
                      
                      <Button
                        onClick={() => handleGenerateContent(contentType)}
                        disabled={isGenerating}
                        className="w-full"
                        size="sm"
                        variant={hasContent ? "outline" : "default"}
                      >
                        {isGenerating ? (
                          <>
                            <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                            Generating...
                          </>
                        ) : hasContent ? (
                          <>
                            <Sparkles className="w-3 h-3 mr-2" />
                            Regenerate
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3 h-3 mr-2" />
                            Generate
                          </>
                        )}
                      </Button>

                      {hasContent && (
                        <div className="flex gap-1">
                          <Button
                            onClick={() => handleCopyContent(contentType)}
                            variant="outline"
                            size="sm"
                            className="flex-1"
                          >
                            <Copy className="w-3 h-3 mr-1" />
                            Copy
                          </Button>
                          <Button
                            onClick={() => handleApproveContent(contentType)}
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            disabled={isApproved}
                          >
                            {isApproved ? (
                              <Check className="w-3 h-3" />
                            ) : (
                              <>
                                <Check className="w-3 h-3 mr-1" />
                                Approve
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="preview" className="space-y-4">
            {contentTypes.map((contentType) => {
              const content = generatedContent[contentType.id];
              const IconComponent = contentType.icon;
              
              if (!content) return null;

              return (
                <Card key={contentType.id}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <IconComponent className="w-4 h-4" />
                      {contentType.name}
                      <Button variant="ghost" size="sm" className="ml-auto">
                        <Edit className="w-3 h-3 mr-1" />
                        Edit
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-gray-50 p-3 rounded-md">
                      <p className="text-sm whitespace-pre-wrap">{content}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            
            {Object.keys(generatedContent).length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p className="font-medium">No content generated yet</p>
                <p className="text-sm">Switch to the Content Generation tab to create content</p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={onClose}>
            Save & Continue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
