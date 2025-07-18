import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { EmailBlock, ContentBlock } from '@/types/emailBuilder';
import { supabase } from '@/integrations/supabase/client';
import { FileText, Sparkles, Bookmark, Calendar, Plus } from 'lucide-react';
import { toast } from 'sonner';

interface ContentIntegrationSidebarProps {
  open: boolean;
  onClose: () => void;
  onAddBlock: (block: EmailBlock) => void;
  campaignId?: string;
}

export const ContentIntegrationSidebar: React.FC<ContentIntegrationSidebarProps> = ({
  open,
  onClose,
  onAddBlock,
  campaignId
}) => {
  const [weeklyThemes, setWeeklyThemes] = useState<any[]>([]);
  const [customContent, setCustomContent] = useState<any[]>([]);
  const [savedTemplates, setSavedTemplates] = useState<any[]>([]);
  const [aiPrompt, setAiPrompt] = useState('');
  const [selectedPersona, setSelectedPersona] = useState('');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (open) {
      loadWeeklyThemes();
      loadCustomContent();
      loadSavedTemplates();
    }
  }, [open]);

  const loadWeeklyThemes = async () => {
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .order('week_number');
    
    if (!error) {
      setWeeklyThemes(data || []);
    }
  };

  const loadCustomContent = async () => {
    const { data, error } = await supabase
      .from('content_tasks')
      .select('*')
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (!error) {
      setCustomContent(data || []);
    }
  };

  const loadSavedTemplates = async () => {
    const { data, error } = await supabase
      .from('content_templates')
      .select('*')
      .eq('type', 'email')
      .order('usage_count', { ascending: false });
    
    if (!error) {
      setSavedTemplates(data || []);
    }
  };

  const generateAIContent = async () => {
    if (!aiPrompt.trim()) {
      toast.error('Please enter a prompt');
      return;
    }

    setGenerating(true);
    try {
      // This would call your AI generation edge function
      const response = await supabase.functions.invoke('generate-email-content', {
        body: { 
          prompt: aiPrompt, 
          persona: selectedPersona,
          type: 'email_block'
        }
      });

      if (response.error) throw response.error;

      const aiBlock: EmailBlock = {
        id: crypto.randomUUID(),
        block_type: 'text',
        content: {
          title: response.data.title || 'AI Generated Content',
          content: response.data.content
        },
        order_index: 0,
        campaign_id: campaignId || '',
        source: 'ai',
        persona_tag: selectedPersona
      };

      onAddBlock(aiBlock);
      setAiPrompt('');
      toast.success('AI content added to your email');
    } catch (error) {
      console.error('Error generating AI content:', error);
      toast.error('Failed to generate AI content');
    } finally {
      setGenerating(false);
    }
  };

  const addThemeContent = (theme: any) => {
    const themeBlock: EmailBlock = {
      id: crypto.randomUUID(),
      block_type: 'text',
      content: {
        title: theme.title,
        content: theme.description
      },
      order_index: 0,
      campaign_id: campaignId || '',
      source: 'newsletter'
    };

    onAddBlock(themeBlock);
    toast.success('Theme content added to your email');
  };

  const addCustomContent = (content: any) => {
    const contentBlock: EmailBlock = {
      id: crypto.randomUUID(),
      block_type: 'text',
      content: {
        title: 'Approved Content',
        content: content.ai_output
      },
      image_url: content.image_url,
      order_index: 0,
      campaign_id: campaignId || '',
      source: 'approved'
    };

    onAddBlock(contentBlock);
    toast.success('Custom content added to your email');
  };

  const addTemplate = (template: any) => {
    const templateBlock: EmailBlock = {
      id: crypto.randomUUID(),
      block_type: 'text',
      content: {
        title: template.title,
        content: template.content
      },
      order_index: 0,
      campaign_id: campaignId || '',
      source: 'template'
    };

    onAddBlock(templateBlock);
    toast.success('Template added to your email');
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-96 sm:w-[500px]">
        <SheetHeader>
          <SheetTitle>Add Content to Email</SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="themes" className="mt-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="themes" className="text-xs">
              <Calendar className="w-4 h-4 mr-1" />
              Themes
            </TabsTrigger>
            <TabsTrigger value="content" className="text-xs">
              <FileText className="w-4 h-4 mr-1" />
              Content
            </TabsTrigger>
            <TabsTrigger value="ai" className="text-xs">
              <Sparkles className="w-4 h-4 mr-1" />
              AI Assist
            </TabsTrigger>
            <TabsTrigger value="templates" className="text-xs">
              <Bookmark className="w-4 h-4 mr-1" />
              Templates
            </TabsTrigger>
          </TabsList>

          <TabsContent value="themes" className="mt-4">
            <ScrollArea className="h-[calc(100vh-200px)]">
              <div className="space-y-3">
                {weeklyThemes.map((theme) => (
                  <Card key={theme.id} className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">{theme.title}</CardTitle>
                        <Badge variant="outline">Week {theme.week_number}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                        {theme.description}
                      </p>
                      <Button
                        size="sm"
                        onClick={() => addThemeContent(theme)}
                        className="w-full"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add to Email
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="content" className="mt-4">
            <ScrollArea className="h-[calc(100vh-200px)]">
              <div className="space-y-3">
                {customContent.map((content) => (
                  <Card key={content.id} className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-3">
                        {content.image_url && (
                          <img
                            src={content.image_url}
                            alt="Content"
                            className="w-16 h-16 object-cover rounded"
                          />
                        )}
                        <div className="flex-1">
                          <p className="text-sm mb-2 line-clamp-3">
                            {content.ai_output}
                          </p>
                          <Button
                            size="sm"
                            onClick={() => addCustomContent(content)}
                            className="w-full"
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            Add to Email
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="ai" className="mt-4">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  What would you like to generate?
                </label>
                <Textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="Generate a compelling headline for fall garden preparation..."
                  rows={4}
                />
              </div>
              
              <Button
                onClick={generateAIContent}
                disabled={generating || !aiPrompt.trim()}
                className="w-full"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                {generating ? 'Generating...' : 'Generate Content'}
              </Button>

              <div className="border-t pt-4">
                <h4 className="text-sm font-medium mb-2">Quick AI Prompts</h4>
                <div className="space-y-2">
                  {[
                    'Write a compelling subject line for fall garden newsletter',
                    'Create a CTA for seasonal plant care products',
                    'Generate tips for winter garden preparation',
                    'Write an introduction for holiday plant gifts'
                  ].map((prompt, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      className="w-full justify-start text-left"
                      onClick={() => setAiPrompt(prompt)}
                    >
                      {prompt}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="templates" className="mt-4">
            <ScrollArea className="h-[calc(100vh-200px)]">
              <div className="space-y-3">
                {savedTemplates.map((template) => (
                  <Card key={template.id} className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">{template.title}</CardTitle>
                        <Badge variant="secondary">
                          Used {template.usage_count || 0}x
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {template.description && (
                        <p className="text-sm text-muted-foreground mb-3">
                          {template.description}
                        </p>
                      )}
                      <Button
                        size="sm"
                        onClick={() => addTemplate(template)}
                        className="w-full"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add Template
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};