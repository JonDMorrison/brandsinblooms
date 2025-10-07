import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { SafeHtml } from '@/components/ui/safe-html';
import { renderMarkdownToMagazineHtml } from '@/utils/renderMarkdown';
import { convertMarkdownToHtml } from '@/utils/markdownUtils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { Calendar, Mail, MessageSquare, Facebook, Instagram, Edit, Image as ImageIcon, Sparkles, Replace, Plus, Clock, Tag, FileText, Check } from 'lucide-react';
import { format } from 'date-fns';
import { parseMonthParam } from '@/utils/dateUtils';
import { usePlanWizard } from '../PlanWizardContext';
import { PlanItem } from '../constants';
import { generateMultiThemeSeasonalPlanContent } from '@/services/seasonalPlanGenerator';
import { MediaSelectorImage } from '@/components/crm/MediaSelectorImage';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useLoading } from '@/contexts/LoadingContext';
import { ProgressiveLoadingCard } from '@/components/dashboard/ProgressiveLoadingCard';
import { Skeleton } from '@/components/ui/skeleton';
import { SocialPostPreviewModal } from '@/components/publish/preview/SocialPostPreviewModal';
import { Eye } from 'lucide-react';
import { MergeTagsPreviewDialog } from '@/components/crm/MergeTagsPreviewDialog';
import { useAuth } from '@/contexts/AuthContext';

interface PlanStepCalendarProps {
  onNext: () => void;
  onBack: () => void;
}

const typeConfig = {
  email: { icon: Mail, color: 'bg-blue-500', label: 'Email', emoji: '📧' },
  sms: { icon: MessageSquare, color: 'bg-green-500', label: 'SMS', emoji: '💬' },
  facebook: { icon: Facebook, color: 'bg-blue-600', label: 'Facebook', emoji: '📘' },
  instagram: { icon: Instagram, color: 'bg-pink-500', label: 'Instagram', emoji: '📱' },
  blog: { icon: FileText, color: 'bg-purple-500', label: 'Blog', emoji: '📝' }
};

const getWeekLabel = (weekNum: number, month: string) => {
  const monthName = month ? format(parseMonthParam(month), 'MMMM') : '';
  
  switch (weekNum) {
    case 1: return `Early ${monthName}`;
    case 2: return `Mid ${monthName}`;
    case 3: return `Late ${monthName}`;
    case 4: return `End ${monthName}`;
    default: return `Week ${weekNum}`;
  }
};

export const PlanStepCalendar: React.FC<PlanStepCalendarProps> = ({ onNext, onBack }) => {
  const { state, setItems, updateItem, toggleItem, replaceWeekContent, addWeekContent } = usePlanWizard();
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [previewItem, setPreviewItem] = useState<PlanItem | null>(null);
  const [previewPlatform, setPreviewPlatform] = useState<'instagram' | 'facebook'>('instagram');
  const [expandedBlogs, setExpandedBlogs] = useState<Set<string>>(new Set());
  const [featuredImage, setFeaturedImage] = useState<{ url: string; metadata: any } | null>(null);
  const { setLoading, clearLoading } = useLoading();
  const { user } = useAuth();

  // Helper functions for blog expansion
  const toggleBlogExpansion = (itemId: string) => {
    const newExpanded = new Set(expandedBlogs);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedBlogs(newExpanded);
  };

  const truncateText = (text: string, maxLength: number = 300) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  // Generate initial seasonal content when component mounts
  useEffect(() => {
    if (state.themes.length > 0 && state.month && state.items.length === 0) {
      setIsInitialLoading(true);
      setLoading('plan-calendar', {
        isLoading: true,
        message: 'Generating your content calendar...',
        priority: 'page'
      });

      // Fetch featured image first
      const featuredQuery = `${state.themes[0]?.label || 'garden'} ${format(parseMonthParam(state.month), 'MMMM')} professional`;
      console.log('[PlanStepCalendar] Fetching featured image:', featuredQuery);
      
      supabase.functions.invoke('get-unsplash-image', {
        body: { query: featuredQuery }
      }).then(({ data: featuredData, error: featuredError }) => {
        if (!featuredError && featuredData?.urls?.regular) {
          const featured = {
            url: featuredData.urls.regular,
            metadata: {
              alt: featuredData.alt_description || featuredQuery,
              photographer: featuredData.user?.name,
              photographer_url: featuredData.user?.links?.html,
              source: 'unsplash_featured',
              unsplash_id: featuredData.id
            }
          };
          setFeaturedImage(featured);
          console.log('[PlanStepCalendar] Featured image loaded:', featured.url);
          toast.success('Featured image loaded');
        }
      }).catch(err => {
        console.warn('[PlanStepCalendar] Featured image fetch failed:', err);
      });

      generateMultiThemeSeasonalPlanContent(state.themes, state.month)
        .then(async (generatedItems) => {
          setItems(generatedItems);
          console.log('[PlanStepCalendar] Generated', generatedItems.length, 'items');
          
          // Ensure all Facebook, Instagram, Blog, and Email posts have imageQuery if missing
          generatedItems.forEach(item => {
            if (['facebook', 'instagram', 'blog', 'email'].includes(item.type) && !item.imageQuery) {
              // Create fallback imageQuery from theme and content type
              const themeName = item.themeName || state.themes[0]?.label || 'garden';
              const typeKeywords = {
                facebook: 'community garden',
                instagram: 'beautiful garden',
                blog: 'garden guide',
                email: 'newsletter garden'
              };
              item.imageQuery = `${themeName} ${typeKeywords[item.type as keyof typeof typeKeywords] || 'garden'}`;
              console.log(`[PlanStepCalendar] Added fallback imageQuery for ${item.type}: "${item.imageQuery}"`);
            }
          });
          
          // Auto-fetch images for Facebook, Instagram, Blog, and Email posts
          const itemsNeedingImages = generatedItems.filter(item => 
            ['facebook', 'instagram', 'blog', 'email'].includes(item.type) && 
            item.imageQuery && 
            !item.imageUrl
          );
          
          if (itemsNeedingImages.length > 0) {
            console.log(`[PlanStepCalendar] Auto-fetching ${itemsNeedingImages.length} images...`);
            toast.info(`Generating ${itemsNeedingImages.length} images...`);
            
            try {
              // Note: Items don't have taskId yet (not persisted), so we'll fetch images
              // and update local state. Images will be properly saved when plan is launched.
              const tasks = itemsNeedingImages.map(item => ({
                itemId: item.id,
                imageQuery: item.imageQuery!
              }));
              
              // Fetch images one by one and update state progressively
              let successCount = 0;
              for (const task of tasks) {
                try {
                  const { data: imageData, error } = await supabase.functions.invoke('get-unsplash-image', {
                    body: { query: task.imageQuery }
                  });
                  
                  if (!error && imageData?.urls?.regular) {
                    // Update the item in state with fetched image
                    updateItem(task.itemId, {
                      imageUrl: imageData.urls.regular,
                      imageMetadata: {
                        alt: imageData.alt_description || task.imageQuery,
                        photographer: imageData.user?.name,
                        photographer_url: imageData.user?.links?.html,
                        source: 'unsplash_auto',
                        unsplash_id: imageData.id
                      }
                    });
                    successCount++;
                    console.log(`[PlanStepCalendar] Fetched image ${successCount}/${tasks.length}`);
                  }
                  
                  // Small delay to respect rate limits
                  await new Promise(resolve => setTimeout(resolve, 150));
                } catch (err) {
                  console.warn(`[PlanStepCalendar] Failed to fetch image for ${task.itemId}:`, err);
                }
              }
              
              if (successCount > 0) {
                toast.success(`Generated ${successCount} images`);
              } else {
                toast.warning('No images were fetched. You can add them manually later.');
              }
            } catch (error) {
              console.error('[PlanStepCalendar] Error fetching images:', error);
              toast.warning('Some images could not be fetched. You can add them manually.');
            }
          }
        })
        .catch(error => {
          console.error('Error generating multi-theme content:', error);
          // Fallback to basic items if seasonal generation fails
          setItems([]);
          toast.error('Failed to generate content. Please try regenerating.');
        })
        .finally(() => {
          setIsInitialLoading(false);
          clearLoading('plan-calendar');
        });
    }
  }, [state.themes, state.month, state.items.length, setItems, setLoading, clearLoading, user, updateItem]);

  const handleItemUpdate = (id: string, field: keyof PlanItem, value: any) => {
    updateItem(id, { [field]: value });
  };

  const handleImageSelect = (itemId: string, imageUrl: string, metadata?: any) => {
    updateItem(itemId, { 
      imageUrl,
      imageMetadata: metadata 
    });
  };

  const useFeaturedImage = (itemId: string) => {
    if (featuredImage) {
      updateItem(itemId, {
        imageUrl: featuredImage.url,
        imageMetadata: featuredImage.metadata
      });
      toast.success('Featured image applied');
    }
  };

  // Regenerate content with AI
  const handleRegenerateWithAI = async () => {
    if (state.themes.length === 0 || !state.month) return;
    
    setIsRegenerating(true);
    setLoading('plan-regenerate', {
      isLoading: true,
      message: 'Regenerating content with proper templates and MediaSelector...',
      priority: 'page'
    });
    try {
      // Use the new multichannel content generation with proper templates
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) throw new Error('User not authenticated');

      const { data: me } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', currentUser.id)
        .single();
      
      const workspaceId = me?.tenant_id || currentUser.id;

      const response = await supabase.functions.invoke('generate-multichannel-content', {
        body: {
          mode: 'custom',
          userIdea: {
            title: state.themes.map(t => t.label).join(' + '),
            notes: state.themes.map(t => t.description).join('; '),
            tone: 'professional and helpful'
          },
          workspaceId,
          channels: ['newsletter', 'instagram', 'facebook', 'blog', 'video']
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      // Convert the multichannel response back to plan items
      if (response.data?.items) {
        const enhancedItems = await generateMultiThemeSeasonalPlanContent(state.themes, state.month);
        
        // Enhance with AI-generated content from proper templates
        response.data.items.forEach((aiItem: any, index: number) => {
          const matchingItem = enhancedItems[index % enhancedItems.length];
          if (matchingItem) {
            if (aiItem.channel === 'newsletter') {
              matchingItem.caption = aiItem.body || aiItem.content || '';
              matchingItem.enhancedContent = {
                title: aiItem.title || matchingItem.title,
                fullContent: aiItem.body || '',
                blocks: aiItem.blocks || []
              };
            } else if (aiItem.channel === 'instagram' || aiItem.channel === 'facebook') {
              matchingItem.caption = aiItem.caption || aiItem.body || '';
            } else if (aiItem.channel === 'blog') {
              matchingItem.enhancedContent = {
                title: aiItem.title || matchingItem.title,
                fullContent: aiItem.markdown || aiItem.body || '',
                summary: aiItem.summary || ''
              };
            }
          }
        });
        
        setItems(enhancedItems);
      }
      
      toast.success('Content regenerated with CRM templates and MediaSelector!');
    } catch (error) {
      console.error('Error regenerating content:', error);
      toast.error('Failed to regenerate content. Using seasonal templates.');
      // Fallback to regular seasonal content
      try {
        const fallbackItems = await generateMultiThemeSeasonalPlanContent(state.themes, state.month);
        setItems(fallbackItems);
      } catch (fallbackError) {
        toast.error('Unable to regenerate content');
      }
    } finally {
      setIsRegenerating(false);
      clearLoading('plan-regenerate');
    }
  };

  // Group items by week
  const itemsByWeek = state.items.reduce((acc, item) => {
    if (!acc[item.week]) acc[item.week] = [];
    acc[item.week].push(item);
    return acc;
  }, {} as Record<number, PlanItem[]>);

  const monthName = state.month ? format(parseMonthParam(state.month), 'MMMM yyyy') : '';

  // Get theme breakdown for display
  const themeBreakdown = state.themes.map(theme => {
    const themeItems = state.items.filter(item => item.themeId === theme.id);
    return {
      theme,
      count: themeItems.length,
      channels: [...new Set(themeItems.map(item => item.type))]
    };
  });

  const isLoading = isInitialLoading || isRegenerating;

  // Show loading state during initial generation
  if (isInitialLoading && state.items.length === 0) {
    return (
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-2">
            <Calendar className="h-8 w-8 text-primary" />
            <h2 className="text-3xl font-bold">Review Your Content Calendar</h2>
          </div>
          <p className="text-muted-foreground text-lg">
            Your multi-theme content plan for {monthName}
          </p>
        </div>

        <ProgressiveLoadingCard
          title="Generating Your Content Calendar"
          description="AI is creating personalized content based on your selected themes"
          expectedContent="Email campaigns, social media posts, and promotional content optimized for your business"
          isLoading={true}
        />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-2">
          <Calendar className="h-8 w-8 text-primary" />
          <h2 className="text-3xl font-bold">Review Your Content Calendar</h2>
        </div>
        <p className="text-muted-foreground text-lg">
          Your multi-theme content plan for {monthName}. Edit, swap content packs, and add extra campaigns.
        </p>
        
        {/* Theme Breakdown */}
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          {themeBreakdown.map(({ theme, count, channels }) => (
            <Badge key={theme.id} variant="secondary" className="gap-2">
              {theme.label}: {count} items ({channels.map(c => typeConfig[c]?.emoji || c).join('')})
            </Badge>
          ))}
        </div>
        
      </div>

      {/* Content Calendar */}
      <div className="space-y-6">
        {Object.keys(itemsByWeek)
          .sort((a, b) => Number(a) - Number(b))
          .map((weekNum) => {
            const weekItems = itemsByWeek[Number(weekNum)];
            const weekLabel = getWeekLabel(Number(weekNum), state.month);
            
            return (
              <Card key={weekNum} className="overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-muted/50 to-muted/30">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      {weekLabel}
                    </CardTitle>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="gap-2">
                        <Replace className="h-4 w-4" />
                        Replace Pack
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 bg-muted/20">
                  <div className="space-y-4">
                    {weekItems.map((item, index) => {
                      const TypeIcon = typeConfig[item.type].icon;
                      const isEditing = editingItem === item.id;
                      
                      return (
                        <Card key={item.id} className={`m-4 shadow-lg hover:shadow-xl transition-shadow duration-300 ${
                          !item.enabled ? 'opacity-50' : ''
                        }`}>
                          <CardContent className="p-6">
                            <div className="flex items-start gap-4">
                              {/* Type Icon & Featured Image Option */}
                              <div className="flex-shrink-0 space-y-2">
                                <div className={`w-10 h-10 rounded-full ${typeConfig[item.type].color} flex items-center justify-center text-white shadow-md`}>
                                  <TypeIcon className="h-5 w-5" />
                                </div>
                                {featuredImage && !item.imageUrl && ['facebook', 'instagram', 'blog', 'email'].includes(item.type) && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => useFeaturedImage(item.id)}
                                    className="w-10 h-10 p-0"
                                    title="Use featured image"
                                  >
                                    <img 
                                      src={featuredImage.url} 
                                      alt="Featured" 
                                      className="w-full h-full object-cover rounded"
                                    />
                                  </Button>
                                )}
                              </div>
                            
                            {/* Content */}
                            <div className="flex-1 space-y-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <Badge variant="outline" className="text-xs">
                                    {typeConfig[item.type].label}
                                  </Badge>
                                  {item.themeName && (
                                    <Badge variant="secondary" className="text-xs">
                                      {item.themeName}
                                    </Badge>
                                  )}
                                  <span className="text-sm text-muted-foreground">
                                    {format(item.date, 'MMM d, yyyy')}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setEditingItem(isEditing ? null : item.id)}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                   <div 
                                     className="flex items-center gap-3 bg-muted/50 hover:bg-muted/70 px-3 py-2 rounded-lg cursor-pointer transition-colors group/toggle"
                                     onClick={(e) => {
                                       e.stopPropagation();
                                       toggleItem(item.id);
                                     }}
                                     onKeyDown={(e) => {
                                       if (e.key === 'Enter' || e.key === ' ') {
                                         e.preventDefault();
                                         e.stopPropagation();
                                         toggleItem(item.id);
                                       }
                                     }}
                                     role="button"
                                     tabIndex={0}
                                     aria-label={`Toggle ${item.enabled ? 'off' : 'on'}`}
                                     title="Click to toggle active/inactive"
                                   >
                                     <div className="flex items-center gap-2">
                                       <div className={`w-3 h-3 rounded-full transition-colors ${
                                         item.enabled ? 'bg-green-500 group-hover/toggle:bg-green-600' : 'bg-gray-300 group-hover/toggle:bg-gray-400'
                                       }`} />
                                       <span className={`text-sm font-medium transition-colors ${
                                         item.enabled 
                                           ? 'text-green-700 group-hover/toggle:text-green-800' 
                                           : 'text-gray-500 group-hover/toggle:text-gray-600'
                                       }`}>
                                         {item.enabled ? 'Active' : 'Inactive'}
                                       </span>
                                     </div>
                                      <Switch
                                        id={`toggle-${item.id}`}
                                        checked={item.enabled}
                                        onCheckedChange={() => toggleItem(item.id)}
                                        onClick={(e) => e.stopPropagation()} // Prevent double toggle from container
                                       className="relative h-6 w-11 data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-gray-300 border-2 data-[state=checked]:border-green-600 data-[state=unchecked]:border-gray-400 shadow-md transition-all duration-300 ease-in-out hover:shadow-lg hover:scale-105 active:scale-95 [&>span]:h-4 [&>span]:w-4 [&>span]:bg-white [&>span]:shadow-lg [&>span]:transition-all [&>span]:duration-300 [&>span]:ease-in-out data-[state=checked]:[&>span]:translate-x-5 data-[state=unchecked]:[&>span]:translate-x-0.5"
                                       data-switch
                                       aria-label={`Toggle ${item.enabled ? 'off' : 'on'}`}
                                     />
                                   </div>
                                </div>
                              </div>
                              
                              {isEditing ? (
                                <div className="space-y-4 bg-muted/30 p-4 rounded-lg">
                                  <div>
                                    <Label htmlFor={`title-${item.id}`}>Title</Label>
                                    <Input
                                      id={`title-${item.id}`}
                                      value={item.title}
                                      onChange={(e) => handleItemUpdate(item.id, 'title', e.target.value)}
                                      className="mt-1"
                                    />
                                  </div>
                                   {/* Email-specific fields first */}
                                   {item.type === 'email' && (
                                     <>
                                        <div>
                                          <div className="flex items-center justify-between">
                                            <Label htmlFor={`subject-${item.id}`}>Subject Line</Label>
                                            <DropdownMenu>
                                              <DropdownMenuTrigger asChild>
                                                <Button variant="outline" size="sm" className="gap-2">
                                                  <Tag className="h-3 w-3" />
                                                  Merge Tags
                                                </Button>
                                              </DropdownMenuTrigger>
                                               <DropdownMenuContent align="end" className="w-48">
                                                 <DropdownMenuLabel>Insert Tag</DropdownMenuLabel>
                                                  <DropdownMenuItem 
                                                    onClick={() => handleItemUpdate(item.id, 'emailSubject', (item.emailSubject || '') + '{{first_name}}')}
                                                  >
                                                    {'{{first_name}}'}
                                                  </DropdownMenuItem>
                                                  <DropdownMenuItem 
                                                    onClick={() => handleItemUpdate(item.id, 'emailSubject', (item.emailSubject || '') + '{{last_name}}')}
                                                  >
                                                    {'{{last_name}}'}
                                                  </DropdownMenuItem>
                                                  <DropdownMenuSeparator />
                                                  <DropdownMenuLabel>Company Info</DropdownMenuLabel>
                                                  <DropdownMenuItem 
                                                    onClick={() => handleItemUpdate(item.id, 'emailSubject', (item.emailSubject || '') + '{{company_name}}')}
                                                  >
                                                    {'{{company_name}}'}
                                                  </DropdownMenuItem>
                                                  <DropdownMenuSeparator />
                                                  <DropdownMenuLabel>Preview</DropdownMenuLabel>
                                                  <MergeTagsPreviewDialog
                                                    emailContent={{
                                                      subject: item.emailSubject,
                                                      preheader: item.emailPreheader,
                                                      body: item.caption
                                                    }}
                                                    onMergeComplete={(content, field) => {
                                                      if (field === 'subject') {
                                                        handleItemUpdate(item.id, 'emailSubject', content);
                                                      }
                                                    }}
                                                  >
                                                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                                      Preview with Customer...
                                                    </DropdownMenuItem>
                                                  </MergeTagsPreviewDialog>
                                               </DropdownMenuContent>
                                            </DropdownMenu>
                                          </div>
                                          <Input
                                            id={`subject-${item.id}`}
                                            value={item.emailSubject || ''}
                                            onChange={(e) => handleItemUpdate(item.id, 'emailSubject', e.target.value)}
                                            className="mt-1"
                                            placeholder="Enter email subject..."
                                          />
                                          <p className="text-xs text-muted-foreground mt-1">
                                            {item.emailSubject?.length || 0}/50 characters
                                          </p>
                                        </div>
                                        <div>
                                          <div className="flex items-center justify-between">
                                            <Label htmlFor={`preheader-${item.id}`}>Preheader</Label>
                                            <DropdownMenu>
                                              <DropdownMenuTrigger asChild>
                                                <Button variant="outline" size="sm" className="gap-2">
                                                  <Tag className="h-3 w-3" />
                                                  Merge Tags
                                                </Button>
                                              </DropdownMenuTrigger>
                                               <DropdownMenuContent align="end" className="w-48">
                                                 <DropdownMenuLabel>Insert Tag</DropdownMenuLabel>
                                                  <DropdownMenuItem 
                                                    onClick={() => handleItemUpdate(item.id, 'emailPreheader', (item.emailPreheader || '') + '{{first_name}}')}
                                                  >
                                                    {'{{first_name}}'}
                                                  </DropdownMenuItem>
                                                  <DropdownMenuItem 
                                                    onClick={() => handleItemUpdate(item.id, 'emailPreheader', (item.emailPreheader || '') + '{{last_name}}')}
                                                  >
                                                    {'{{last_name}}'}
                                                  </DropdownMenuItem>
                                                  <DropdownMenuSeparator />
                                                  <DropdownMenuLabel>Company Info</DropdownMenuLabel>
                                                  <DropdownMenuItem 
                                                    onClick={() => handleItemUpdate(item.id, 'emailPreheader', (item.emailPreheader || '') + '{{company_name}}')}
                                                  >
                                                    {'{{company_name}}'}
                                                  </DropdownMenuItem>
                                                  <DropdownMenuSeparator />
                                                  <DropdownMenuLabel>Preview</DropdownMenuLabel>
                                                  <MergeTagsPreviewDialog
                                                    emailContent={{
                                                      subject: item.emailSubject,
                                                      preheader: item.emailPreheader,
                                                      body: item.caption
                                                    }}
                                                    onMergeComplete={(content, field) => {
                                                      if (field === 'preheader') {
                                                        handleItemUpdate(item.id, 'emailPreheader', content);
                                                      }
                                                    }}
                                                  >
                                                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                                      Preview with Customer...
                                                    </DropdownMenuItem>
                                                  </MergeTagsPreviewDialog>
                                               </DropdownMenuContent>
                                            </DropdownMenu>
                                          </div>
                                          <Input
                                            id={`preheader-${item.id}`}
                                            value={item.emailPreheader || ''}
                                            onChange={(e) => handleItemUpdate(item.id, 'emailPreheader', e.target.value)}
                                            className="mt-1"
                                            placeholder="Enter email preheader..."
                                          />
                                          <p className="text-xs text-muted-foreground mt-1">
                                            {item.emailPreheader?.length || 0}/90 characters
                                          </p>
                                        </div>
                                     </>
                                   )}
                                   
                                   <div>
                                     <Label htmlFor={`date-${item.id}`}>Date</Label>
                                     <Input
                                       id={`date-${item.id}`}
                                       type="date"
                                       value={format(item.date, 'yyyy-MM-dd')}
                                       onChange={(e) => {
                                         const newDate = new Date(e.target.value);
                                         handleItemUpdate(item.id, 'date', newDate);
                                       }}
                                       className="mt-1 max-w-xs"
                                     />
                                   </div>
                                   
                                   <div>
                                     <div className="flex items-center justify-between">
                                        <Label htmlFor={`caption-${item.id}`}>
                                          {item.type === 'email' ? 'Email Content' : item.type === 'blog' ? 'Blog Content' : 'Caption'}
                                        </Label>
                                       {item.type === 'email' && (
                                         <DropdownMenu>
                                           <DropdownMenuTrigger asChild>
                                             <Button variant="outline" size="sm" className="gap-2">
                                               <Tag className="h-3 w-3" />
                                               Merge Tags
                                             </Button>
                                           </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-48">
                                              <DropdownMenuLabel>Insert Tag</DropdownMenuLabel>
                                               <DropdownMenuItem 
                                                 onClick={() => handleItemUpdate(item.id, 'caption', item.caption + '{{first_name}}')}
                                               >
                                                 {'{{first_name}}'}
                                               </DropdownMenuItem>
                                               <DropdownMenuItem 
                                                 onClick={() => handleItemUpdate(item.id, 'caption', item.caption + '{{last_name}}')}
                                               >
                                                 {'{{last_name}}'}
                                               </DropdownMenuItem>
                                               <DropdownMenuItem 
                                                 onClick={() => handleItemUpdate(item.id, 'caption', item.caption + '{{email}}')}
                                               >
                                                 {'{{email}}'}
                                               </DropdownMenuItem>
                                               <DropdownMenuSeparator />
                                               <DropdownMenuLabel>Company Info</DropdownMenuLabel>
                                               <DropdownMenuItem 
                                                 onClick={() => handleItemUpdate(item.id, 'caption', item.caption + '{{company_name}}')}
                                               >
                                                 {'{{company_name}}'}
                                               </DropdownMenuItem>
                                               <DropdownMenuItem 
                                                 onClick={() => handleItemUpdate(item.id, 'caption', item.caption + '{{website}}')}
                                               >
                                                 {'{{website}}'}
                                               </DropdownMenuItem>
                                               <DropdownMenuSeparator />
                                               <DropdownMenuLabel>Preview</DropdownMenuLabel>
                                               <MergeTagsPreviewDialog
                                                 emailContent={{
                                                   subject: item.emailSubject,
                                                   preheader: item.emailPreheader,
                                                   body: item.caption
                                                 }}
                                                 onMergeComplete={(content, field) => {
                                                   if (field === 'body') {
                                                     handleItemUpdate(item.id, 'caption', content);
                                                   }
                                                 }}
                                               >
                                                 <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                                   Preview with Customer...
                                                 </DropdownMenuItem>
                                               </MergeTagsPreviewDialog>
                                            </DropdownMenuContent>
                                         </DropdownMenu>
                                       )}
                                     </div>
                                      {item.type === 'email' ? (
                                        <RichTextEditor
                                          content={item.caption}
                                          onChange={(html) => handleItemUpdate(item.id, 'caption', html)}
                                          placeholder="Write your email content here..."
                                          className="mt-1"
                                          editorClassName="min-h-[120px]"
                                        />
                                       ) : item.type === 'blog' ? (
                                          <RichTextEditor
                                            content={item.enhancedContent?.fullContent || item.caption}
                                           onChange={(html) => {
                                            const updatedEnhancedContent = {
                                              ...item.enhancedContent,
                                              fullContent: html,
                                              title: item.enhancedContent?.title || item.title
                                            };
                                            handleItemUpdate(item.id, 'enhancedContent', updatedEnhancedContent);
                                          }}
                                          placeholder="Write your blog content here..."
                                          className="mt-1"
                                          editorClassName="min-h-[200px]"
                                        />
                                      ) : (
                                        <Textarea
                                          id={`caption-${item.id}`}
                                          value={item.caption}
                                          onChange={(e) => handleItemUpdate(item.id, 'caption', e.target.value)}
                                          rows={3}
                                          className="mt-1"
                                        />
                                      )}
                                   </div>
                                   {(item.type === 'facebook' || item.type === 'instagram' || item.type === 'email' || item.type === 'blog') && (
                                     <div>
                                       <div className="flex items-center justify-between mb-2">
                                         <Label>Featured Image</Label>
                                         {featuredImage && !item.imageUrl && (
                                           <Button
                                             variant="outline"
                                             size="sm"
                                             onClick={() => useFeaturedImage(item.id)}
                                             className="gap-2"
                                           >
                                             <Check className="h-3 w-3" />
                                             Use Featured Image
                                           </Button>
                                         )}
                                       </div>
                                       
                                       {featuredImage && !item.imageUrl && (
                                         <div className="mb-3 p-3 bg-muted/50 rounded-lg border border-dashed border-primary/30">
                                           <div className="flex items-start gap-3">
                                             <img 
                                               src={featuredImage.url} 
                                               alt="Featured" 
                                               className="w-24 h-24 object-cover rounded"
                                             />
                                             <div className="flex-1 space-y-1">
                                               <p className="text-sm font-medium">Theme Featured Image Available</p>
                                               <p className="text-xs text-muted-foreground">
                                                 {featuredImage.metadata.alt}
                                               </p>
                                               {featuredImage.metadata.photographer && (
                                                 <p className="text-xs text-muted-foreground">
                                                   Photo by {featuredImage.metadata.photographer}
                                                 </p>
                                               )}
                                             </div>
                                           </div>
                                         </div>
                                       )}
                                       
                                       <div className="mt-2">
                                         <MediaSelectorImage
                                           src={item.imageUrl}
                                           onChange={(imageUrl, metadata) => handleImageSelect(item.id, imageUrl, metadata)}
                                           contentContext={`${item.type} ${item.type === 'email' ? 'newsletter' : item.type === 'blog' ? 'article' : 'post'}: ${item.title}`}
                                           className="max-w-md"
                                         />
                                       </div>
                                     </div>
                                    )}
                                   
                                    {/* Action Buttons */}
                                    <div className="flex justify-between pt-2">
                                      {(item.type === 'facebook' || item.type === 'instagram') && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            setPreviewItem(item);
                                            setPreviewPlatform(item.type as 'instagram' | 'facebook');
                                          }}
                                          className="gap-2"
                                        >
                                          <Eye className="h-4 w-4" />
                                          Preview Post
                                        </Button>
                                      )}
                                      <div className="flex-1" />
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setEditingItem(null)}
                                        className="px-4"
                                      >
                                        Save & Close
                                      </Button>
                                    </div>
                                </div>
                               ) : (
                                 <div 
                                    className="space-y-3 cursor-pointer hover:bg-muted/20 -m-2 p-2 rounded-md transition-colors group/content"
                                    onClick={() => setEditingItem(item.id)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        setEditingItem(item.id);
                                      }
                                    }}
                                    role="button"
                                    tabIndex={0}
                                    aria-label="Click to edit content"
                                    title="Click to edit"
                                  >
                                     {/* Email header info at the top */}
                                     {item.type === 'email' && (
                                       <div className="space-y-1 text-xs text-muted-foreground mb-3 p-2 bg-muted/30 rounded">
                                         {item.emailSubject && (
                                           <div><span className="font-medium">Subject:</span> {item.emailSubject}</div>
                                         )}
                                         {item.emailPreheader && (
                                           <div><span className="font-medium">Preheader:</span> {item.emailPreheader}</div>
                                         )}
                                         <div><span className="font-medium">Date:</span> {format(item.date, 'MMM d, yyyy')}</div>
                                       </div>
                                     )}
                                     
                                     <h4 className="font-medium group-hover/content:text-primary transition-colors">{item.title}</h4>
                                     
                                      {/* Content display */}
                                      {item.type === 'email' ? (
                                        <div className="text-sm text-muted-foreground group-hover/content:text-foreground transition-colors">
                                          <SafeHtml content={item.caption} type="general" className="prose prose-sm max-w-none" />
                                        </div>
                                       ) : item.type === 'blog' ? (
                                         <div className="text-sm text-muted-foreground group-hover/content:text-foreground transition-colors">
                                           {(() => {
                                             const fullContent = item.enhancedContent?.fullContent || item.caption;
                                             const isExpanded = expandedBlogs.has(item.id);
                                             const shouldTruncate = fullContent.length > 300;
                                             const displayContent = isExpanded || !shouldTruncate 
                                               ? fullContent 
                                               : truncateText(fullContent, 300);
                                             
                                             return (
                                               <>
                                                 <div 
                                                   className="prose prose-sm max-w-none [&>*]:text-justify"
                                                   dangerouslySetInnerHTML={{ 
                                                     __html: renderMarkdownToMagazineHtml(displayContent) 
                                                   }}
                                                 />
                                                 {shouldTruncate && (
                                                   <button
                                                     onClick={(e) => {
                                                       e.stopPropagation();
                                                       toggleBlogExpansion(item.id);
                                                     }}
                                                     className="text-xs text-primary hover:text-primary/80 font-medium mt-2 block transition-colors"
                                                   >
                                                     {isExpanded ? "Show less" : "Click to see more"}
                                                   </button>
                                                 )}
                                                 {item.enhancedContent?.fullContent && item.enhancedContent.fullContent.length > 200 && (
                                                   <div className="text-xs text-muted-foreground mt-2">
                                                     {item.enhancedContent.fullContent.length} characters
                                                   </div>
                                                 )}
                                               </>
                                             );
                                           })()}
                                         </div>
                                      ) : (
                                        <p className="text-sm text-muted-foreground group-hover/content:text-foreground transition-colors">{item.caption}</p>
                                      )}
                                     {item.imageUrl && (
                                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500 bg-opacity-20 text-sm text-green-600 font-medium">
                                        <Check className="h-3.5 w-3.5" />
                                        <span>Image selected</span>
                                      </div>
                                     )}
                                  </div>
                               )}
                            </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-8">
        <Button 
          variant="outline" 
          onClick={onBack} 
          size="lg" 
          className="px-8"
          disabled={isLoading}
        >
          Back
        </Button>
        <Button 
          onClick={onNext} 
          size="lg" 
          className="px-8"
          disabled={isLoading || state.items.length === 0}
        >
          Review & Launch
        </Button>
      </div>

      {/* Social Post Preview Modal */}
      {previewItem && (
        <SocialPostPreviewModal
          open={true}
          onClose={() => setPreviewItem(null)}
          platform={previewPlatform}
          onPlatformChange={(platform) => setPreviewPlatform(platform)}
          accountName="Your Business"
          caption={previewItem.caption}
          mediaUrl={previewItem.imageUrl || ''}
        />
      )}
    </div>
  );
};