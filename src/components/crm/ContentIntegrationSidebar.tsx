import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmailBlock } from '@/types/emailBuilder';
import { supabase } from '@/integrations/supabase/client';
import { Search, FileText, Sparkles, Bookmark, Calendar, Plus, Loader2, Image, ExternalLink, GripVertical, Edit3, Copy, Trash2, MoreVertical } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { TemplateManagementModal } from '@/components/crm/TemplateManagementModal';
import { toast } from 'sonner';

interface ContentIntegrationSidebarProps {
  open: boolean;
  onClose: () => void;
  onAddBlock: (block: EmailBlock) => void;
  campaignId?: string;
}

interface NewsletterBlock {
  id: string;
  title: string;
  content: string;
  image_url?: string;
  cta_text?: string;
  week_number?: number;
  theme?: string;
}

interface SavedTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  layout_json: EmailBlock[];
  thumbnail_url: string;
  usage_count: number;
  tags: string[];
  created_at: string;
}

interface Persona {
  id: string;
  name: string;
  icon: string;
  color_theme: string;
  description: string;
}

export const ContentIntegrationSidebar: React.FC<ContentIntegrationSidebarProps> = ({
  open,
  onClose,
  onAddBlock,
  campaignId
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [weeklyThemes, setWeeklyThemes] = useState<NewsletterBlock[]>([]);
  const [customContent, setCustomContent] = useState<any[]>([]);
  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [aiPrompt, setAiPrompt] = useState('');
  const [selectedPersona, setSelectedPersona] = useState('');
  const [generating, setGenerating] = useState(false);
  const [loadingStates, setLoadingStates] = useState({
    themes: false,
    content: false,
    templates: false
  });
  const [selectedTemplate, setSelectedTemplate] = useState<SavedTemplate | null>(null);
  const [templateAction, setTemplateAction] = useState<'rename' | 'duplicate' | 'delete' | null>(null);

  useEffect(() => {
    if (open) {
      loadAllContent();
    }
  }, [open]);

  const loadAllContent = () => {
    loadWeeklyThemes();
    loadCustomContent();
    loadSavedTemplates();
    loadPersonas();
  };

  const setLoading = (section: keyof typeof loadingStates, loading: boolean) => {
    setLoadingStates(prev => ({ ...prev, [section]: loading }));
  };

  const loadWeeklyThemes = async () => {
    setLoading('themes', true);
    try {
      // Load newsletter content from content_tasks with post_type = "newsletter"
      const { data, error } = await supabase
        .from('content_tasks')
        .select(`
          id,
          ai_output,
          image_url,
          hashtags,
          campaigns!inner(title, theme, week_number)
        `)
        .eq('post_type', 'newsletter')
        .not('ai_output', 'is', null)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (!error && data) {
        const themes = data.map(item => ({
          id: item.id,
          title: item.campaigns?.title || 'Newsletter Content',
          content: item.ai_output || '',
          image_url: item.image_url,
          cta_text: extractCTAFromContent(item.ai_output),
          week_number: item.campaigns?.week_number,
          theme: item.campaigns?.theme
        }));
        setWeeklyThemes(themes);
      }
    } catch (error) {
      console.error('Error loading weekly themes:', error);
    } finally {
      setLoading('themes', false);
    }
  };

  const loadCustomContent = async () => {
    setLoading('content', true);
    try {
      // Load approved content from various sources
      const { data, error } = await supabase
        .from('content_tasks')
        .select('*')
        .in('status', ['approved', 'completed'])
        .not('ai_output', 'is', null)
        .order('created_at', { ascending: false })
        .limit(15);
      
      if (!error) {
        // Group by category
        const categorized = (data || []).reduce((acc: any, item: any) => {
          const category = item.post_type || 'general';
          if (!acc[category]) acc[category] = [];
          acc[category].push(item);
          return acc;
        }, {});
        
        setCustomContent(categorized);
      }
    } catch (error) {
      console.error('Error loading custom content:', error);
    } finally {
      setLoading('content', false);
    }
  };

  const loadSavedTemplates = async () => {
    setLoading('templates', true);
    try {
      const { data, error } = await supabase
        .from('saved_campaign_templates')
        .select('*')
        .order('usage_count', { ascending: false });
      
      if (!error && data) {
        const templates = data.map(item => ({
          id: item.id,
          name: item.name,
          description: item.description || '',
          category: item.category || 'general',
          layout_json: (typeof item.layout_json === 'string' 
            ? JSON.parse(item.layout_json) 
            : item.layout_json) as EmailBlock[],
          thumbnail_url: item.thumbnail_url || '',
          usage_count: item.usage_count || 0,
          tags: item.tags || [],
          created_at: item.created_at
        }));
        setSavedTemplates(templates);
      }
    } catch (error) {
      console.error('Error loading saved templates:', error);
    } finally {
      setLoading('templates', false);
    }
  };

  const loadPersonas = async () => {
    try {
      const { data, error } = await supabase
        .from('personas')
        .select('*')
        .order('name');
      
      if (!error) {
        setPersonas(data || []);
      }
    } catch (error) {
      console.error('Error loading personas:', error);
    }
  };

  const extractCTAFromContent = (content: string): string => {
    // Simple extraction of CTA text from content
    const ctaMatches = content.match(/\[(.*?)\]|\b(Shop Now|Learn More|Get Started|Buy Now|Download|Subscribe)\b/gi);
    return ctaMatches?.[0]?.replace(/[\[\]]/g, '') || 'Learn More';
  };

  const generateAIContent = async () => {
    if (!aiPrompt.trim()) {
      toast.error('Please enter a prompt');
      return;
    }

    setGenerating(true);
    try {
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
        persona_tag: selectedPersona,
        cta_text: response.data.cta_text,
        cta_url: response.data.cta_url || '#'
      };

      onAddBlock(aiBlock);
      setAiPrompt('');
      toast.success('AI content added to your email');
      onClose();
    } catch (error) {
      console.error('Error generating AI content:', error);
      toast.error('Failed to generate AI content');
    } finally {
      setGenerating(false);
    }
  };

  const addNewsletterBlock = (newsletter: NewsletterBlock) => {
    const block: EmailBlock = {
      id: crypto.randomUUID(),
      block_type: 'text',
      content: {
        title: newsletter.title,
        content: newsletter.content
      },
      image_url: newsletter.image_url,
      cta_text: newsletter.cta_text,
      order_index: 0,
      campaign_id: campaignId || '',
      source: 'newsletter'
    };

    onAddBlock(block);
    toast.success('Newsletter content added to your email');
    onClose();
  };

  const addCustomContent = (content: any) => {
    const block: EmailBlock = {
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

    onAddBlock(block);
    toast.success('Custom content converted and added to your email');
    onClose();
  };

  const addTemplate = async (template: SavedTemplate) => {
    // Add all blocks from template
    template.layout_json.forEach((blockData, index) => {
      const block: EmailBlock = {
        ...blockData,
        id: crypto.randomUUID(),
        order_index: index,
        campaign_id: campaignId || '',
        source: 'template'
      };
      onAddBlock(block);
    });

    // Update usage count
    await supabase
      .from('saved_campaign_templates')
      .update({ usage_count: template.usage_count + 1 })
      .eq('id', template.id);

    toast.success('Template added to your email');
    onClose();
  };

  const handleTemplateAction = (template: SavedTemplate, action: 'rename' | 'duplicate' | 'delete') => {
    setSelectedTemplate(template);
    setTemplateAction(action);
  };

  const closeTemplateModal = () => {
    setSelectedTemplate(null);
    setTemplateAction(null);
  };

  const filteredContent = (items: any[]) => {
    if (!searchQuery) return items;
    return items.filter(item => 
      item.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.ai_output?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-96 sm:w-[500px] overflow-hidden">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Bookmark className="w-5 h-5" />
            Content Library
          </SheetTitle>
        </SheetHeader>

        {/* Search Bar */}
        <div className="relative mt-4">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Tabs defaultValue="themes" className="mt-4 flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="themes" className="text-xs">
              <span className="mr-1">🗂️</span>
              Themes
            </TabsTrigger>
            <TabsTrigger value="content" className="text-xs">
              <span className="mr-1">✍️</span>
              Custom
            </TabsTrigger>
            <TabsTrigger value="ai" className="text-xs">
              <span className="mr-1">🤖</span>
              AI
            </TabsTrigger>
            <TabsTrigger value="templates" className="text-xs">
              <span className="mr-1">💾</span>
              Templates
            </TabsTrigger>
          </TabsList>

          {/* Weekly Themes Tab */}
          <TabsContent value="themes" className="flex-1 mt-4">
            <ScrollArea className="h-[calc(100vh-250px)]">
              {loadingStates.themes ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : (
                <div className="space-y-3 pr-4">
                  {filteredContent(weeklyThemes).map((newsletter) => (
                    <Card key={newsletter.id} className="cursor-pointer hover:shadow-md transition-shadow">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-medium">{newsletter.title}</CardTitle>
                          {newsletter.week_number && (
                            <Badge variant="outline" className="text-xs">
                              Week {newsletter.week_number}
                            </Badge>
                          )}
                        </div>
                        {newsletter.theme && (
                          <p className="text-xs text-muted-foreground">{newsletter.theme}</p>
                        )}
                      </CardHeader>
                      <CardContent>
                        <div className="flex gap-3">
                          {newsletter.image_url && (
                            <div className="w-12 h-12 bg-muted rounded flex-shrink-0 overflow-hidden">
                              <img 
                                src={newsletter.image_url} 
                                alt="Content preview"
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                              {newsletter.content.slice(0, 100)}...
                            </p>
                            {newsletter.cta_text && (
                              <Badge variant="secondary" className="text-xs mb-2">
                                CTA: {newsletter.cta_text}
                              </Badge>
                            )}
                            <Button
                              size="sm"
                              onClick={() => addNewsletterBlock(newsletter)}
                              className="w-full"
                            >
                              <Plus className="w-4 h-4 mr-1" />
                              Insert This Block
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* Custom Content Tab */}
          <TabsContent value="content" className="flex-1 mt-4">
            <ScrollArea className="h-[calc(100vh-250px)]">
              {loadingStates.content ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : (
                <div className="space-y-4 pr-4">
                  {Object.entries(customContent).map(([category, items]) => (
                    <div key={category}>
                      <h4 className="text-sm font-medium mb-2 capitalize flex items-center gap-2">
                        {category === 'social' && '📱'}
                        {category === 'email' && '📧'}
                        {category === 'event' && '🎉'}
                        {category === 'announcement' && '📢'}
                        {category}
                      </h4>
                      <div className="space-y-2">
                        {filteredContent(items as any[]).map((content: any) => (
                          <Card key={content.id} className="hover:shadow-md transition-shadow">
                            <CardContent className="pt-3">
                              <div className="flex items-start gap-3">
                                {content.image_url && (
                                  <div className="w-16 h-16 bg-muted rounded overflow-hidden flex-shrink-0">
                                    <img
                                      src={content.image_url}
                                      alt="Content"
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm mb-2 line-clamp-3">
                                    {content.ai_output?.slice(0, 120)}...
                                  </p>
                                  <Button
                                    size="sm"
                                    onClick={() => addCustomContent(content)}
                                    className="w-full"
                                  >
                                    <Plus className="w-4 h-4 mr-1" />
                                    Insert + Convert to Email
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* AI Assist Tab */}
          <TabsContent value="ai" className="flex-1 mt-4">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Choose Persona (optional)
                </label>
                <Select value={selectedPersona} onValueChange={setSelectedPersona}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a persona..." />
                  </SelectTrigger>
                  <SelectContent>
                    {personas.map((persona) => (
                      <SelectItem key={persona.id} value={persona.name}>
                        <div className="flex items-center gap-2">
                          <span>{persona.icon}</span>
                          <span>{persona.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  What should this block be about?
                </label>
                <Textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="Generate a compelling headline and content for fall garden preparation with care tips..."
                  rows={4}
                />
              </div>
              
              <Button
                onClick={generateAIContent}
                disabled={generating || !aiPrompt.trim()}
                className="w-full"
              >
                {generating ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 mr-2" />
                )}
                {generating ? 'Generating...' : 'Generate Email Block'}
              </Button>

              <div className="border-t pt-4">
                <h4 className="text-sm font-medium mb-2">Quick AI Prompts</h4>
                <div className="space-y-2">
                  {[
                    'Create a compelling subject line for seasonal garden newsletter',
                    'Write a product spotlight with strong CTA for garden tools',
                    'Generate expert tips for winter plant protection',
                    'Create a holiday plant gift guide introduction',
                    'Write a customer success story for garden transformation'
                  ].map((prompt, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      className="w-full justify-start text-left h-auto py-2 px-3"
                      onClick={() => setAiPrompt(prompt)}
                    >
                      <span className="text-xs">{prompt}</span>
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Saved Templates Tab */}
          <TabsContent value="templates" className="flex-1 mt-4">
            <ScrollArea className="h-[calc(100vh-250px)]">
              {loadingStates.templates ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : (
                <div className="space-y-3 pr-4">
                   {savedTemplates.map((template) => (
                     <Card key={template.id} className="group cursor-pointer hover:shadow-md transition-shadow">
                       <CardHeader className="pb-2">
                         <div className="flex items-center justify-between">
                           <CardTitle className="text-sm font-medium">{template.name}</CardTitle>
                           <div className="flex items-center gap-2">
                             <Badge variant="secondary" className="text-xs">
                               Used {template.usage_count}x
                             </Badge>
                             <DropdownMenu>
                               <DropdownMenuTrigger asChild>
                                 <Button 
                                   variant="ghost" 
                                   size="sm" 
                                   className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                   onClick={(e) => e.stopPropagation()}
                                 >
                                   <MoreVertical className="w-3 h-3" />
                                 </Button>
                               </DropdownMenuTrigger>
                               <DropdownMenuContent align="end">
                                 <DropdownMenuItem onClick={() => handleTemplateAction(template, 'rename')}>
                                   <Edit3 className="w-4 h-4 mr-2" />
                                   Rename
                                 </DropdownMenuItem>
                                 <DropdownMenuItem onClick={() => handleTemplateAction(template, 'duplicate')}>
                                   <Copy className="w-4 h-4 mr-2" />
                                   Duplicate
                                 </DropdownMenuItem>
                                 <DropdownMenuItem 
                                   onClick={() => handleTemplateAction(template, 'delete')}
                                   className="text-destructive"
                                 >
                                   <Trash2 className="w-4 h-4 mr-2" />
                                   Delete
                                 </DropdownMenuItem>
                               </DropdownMenuContent>
                             </DropdownMenu>
                           </div>
                         </div>
                       </CardHeader>
                       <CardContent>
                         <div className="flex gap-3">
                           {template.thumbnail_url && (
                             <div className="w-16 h-16 bg-muted rounded overflow-hidden flex-shrink-0">
                               <img
                                 src={template.thumbnail_url}
                                 alt="Template preview"
                                 className="w-full h-full object-cover"
                               />
                             </div>
                           )}
                           <div className="flex-1 min-w-0">
                             {template.description && (
                               <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                                 {template.description}
                               </p>
                             )}
                             <div className="flex items-center gap-1 mb-2">
                               <span className="text-xs text-muted-foreground">
                                 {template.layout_json.length} block{template.layout_json.length !== 1 ? 's' : ''}
                               </span>
                               <span className="text-xs text-muted-foreground">•</span>
                               <span className="text-xs text-muted-foreground">
                                 {new Date(template.created_at).toLocaleDateString()}
                               </span>
                               {template.tags.slice(0, 2).map((tag, index) => (
                                 <Badge key={index} variant="outline" className="text-xs">
                                   {tag}
                                 </Badge>
                               ))}
                             </div>
                             <Button
                               size="sm"
                               onClick={() => addTemplate(template)}
                               className="w-full"
                             >
                               <Plus className="w-4 h-4 mr-1" />
                               Insert Template
                             </Button>
                           </div>
                         </div>
                       </CardContent>
                     </Card>
                   ))}
                  
                   {savedTemplates.length === 0 && (
                     <div className="text-center py-12 text-muted-foreground">
                       <div className="w-16 h-16 mx-auto mb-4 bg-muted/50 rounded-lg flex items-center justify-center">
                         💾
                       </div>
                       <h3 className="font-medium mb-2">You haven't saved any templates yet</h3>
                       <p className="text-sm leading-relaxed max-w-sm mx-auto">
                         After creating your first campaign, click "Save as Template" to reuse it later.
                       </p>
                     </div>
                   )}
                </div>
              )}
            </ScrollArea>
           </TabsContent>
         </Tabs>
       </SheetContent>

       {/* Template Management Modal */}
       {selectedTemplate && templateAction && (
         <TemplateManagementModal
           open={true}
           onClose={closeTemplateModal}
           template={selectedTemplate}
           onTemplateUpdated={() => {
             loadSavedTemplates();
             closeTemplateModal();
           }}
           action={templateAction}
         />
       )}
     </Sheet>
   );
 };