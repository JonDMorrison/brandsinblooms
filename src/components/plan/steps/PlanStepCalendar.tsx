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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { Calendar, Mail, MessageSquare, Facebook, Instagram, Edit, Image as ImageIcon, Sparkles, Replace, Plus, Clock, Tag } from 'lucide-react';
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

interface PlanStepCalendarProps {
  onNext: () => void;
  onBack: () => void;
}

const typeConfig = {
  email: { icon: Mail, color: 'bg-blue-500', label: 'Email', emoji: '📧' },
  sms: { icon: MessageSquare, color: 'bg-green-500', label: 'SMS', emoji: '💬' },
  facebook: { icon: Facebook, color: 'bg-blue-600', label: 'Facebook', emoji: '📘' },
  instagram: { icon: Instagram, color: 'bg-pink-500', label: 'Instagram', emoji: '📱' }
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
  const { setLoading, clearLoading } = useLoading();

  // Generate initial seasonal content when component mounts
  useEffect(() => {
    if (state.themes.length > 0 && state.month && state.items.length === 0) {
      setIsInitialLoading(true);
      setLoading('plan-calendar', {
        isLoading: true,
        message: 'Generating your content calendar...',
        priority: 'page'
      });

      generateMultiThemeSeasonalPlanContent(state.themes, state.month)
        .then(generatedItems => {
          setItems(generatedItems);
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
  }, [state.themes, state.month, state.items.length, setItems, setLoading, clearLoading]);

  const handleItemUpdate = (id: string, field: keyof PlanItem, value: any) => {
    updateItem(id, { [field]: value });
  };

  const handleImageSelect = (itemId: string, imageUrl: string, metadata?: any) => {
    updateItem(itemId, { imageUrl });
  };

  // Regenerate content with AI
  const handleRegenerateWithAI = async () => {
    if (state.themes.length === 0 || !state.month) return;
    
    setIsRegenerating(true);
    setLoading('plan-regenerate', {
      isLoading: true,
      message: 'Regenerating content with AI...',
      priority: 'page'
    });
    try {
      // Call AI content generation for enhanced content
      const response = await supabase.functions.invoke('generate_campaign_content', {
        body: {
          campaignId: `plan-${Date.now()}`,
          campaignTheme: state.themes.map(t => t.label).join(' + '),
          campaignDescription: state.themes.map(t => t.description).join('; '),
          userId: 'plan-user',
          weekNumber: 1,
          tenantId: 'default'
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      // Regenerate content with enhanced AI-powered captions
      const enhancedItems = await generateMultiThemeSeasonalPlanContent(state.themes, state.month);
      
      // If we got AI content, use it to enhance the items
      if (response.data?.success && response.data?.tasks) {
        const aiTasks = response.data.tasks;
        enhancedItems.forEach((item, index) => {
          if (aiTasks[index % aiTasks.length]) {
            item.caption = aiTasks[index % aiTasks.length].task_details;
          }
        });
      }
      
      setItems(enhancedItems);
      toast.success('Content regenerated with AI enhancements!');
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
        
        {/* AI Regenerate Button */}
        <div className="flex justify-center pt-2">
          <Button 
            variant="outline" 
            onClick={handleRegenerateWithAI}
            disabled={isRegenerating}
            className="gap-2"
          >
            <Sparkles className={`h-4 w-4 ${isRegenerating ? 'animate-spin' : ''}`} />
            {isRegenerating ? 'Regenerating...' : 'Regenerate with AI'}
          </Button>
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
                      <Button variant="outline" size="sm" className="gap-2">
                        <Plus className="h-4 w-4" />
                        Add Content
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="space-y-0">
                    {weekItems.map((item, index) => {
                      const TypeIcon = typeConfig[item.type].icon;
                      const isEditing = editingItem === item.id;
                      
                      return (
                        <div key={item.id} className={`p-6 border-b border-border last:border-b-0 ${
                          !item.enabled ? 'opacity-50' : ''
                        }`}>
                          <div className="flex items-start gap-4">
                            {/* Type Icon */}
                            <div className={`flex-shrink-0 w-10 h-10 rounded-full ${typeConfig[item.type].color} flex items-center justify-center text-white`}>
                              <TypeIcon className="h-5 w-5" />
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
                                       onCheckedChange={() => {}} // Handler is on container
                                       onClick={(e) => e.stopPropagation()} // Prevent double toggle
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
                                   <div>
                                     <div className="flex items-center justify-between">
                                       <Label htmlFor={`caption-${item.id}`}>
                                         {item.type === 'email' ? 'Email Content' : 'Caption'}
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
                                             <DropdownMenuLabel>Personal Info</DropdownMenuLabel>
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
                                              <DropdownMenuLabel>Other</DropdownMenuLabel>
                                              <DropdownMenuItem 
                                                onClick={() => handleItemUpdate(item.id, 'caption', item.caption + '{{unsubscribe_url}}')}
                                              >
                                                {'{{unsubscribe_url}}'}
                                              </DropdownMenuItem>
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
                                   
                                   {/* Email-specific fields */}
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
                                                <DropdownMenuLabel>Personal Info</DropdownMenuLabel>
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
                                                <DropdownMenuLabel>Personal Info</DropdownMenuLabel>
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
                                  {(item.type === 'facebook' || item.type === 'instagram') && (
                                    <div>
                                      <Label>Featured Image</Label>
                                      <div className="mt-2">
                                        <MediaSelectorImage
                                          src={item.imageUrl}
                                          onChange={(imageUrl, metadata) => handleImageSelect(item.id, imageUrl, metadata)}
                                          contentContext={`${item.type} post: ${item.title}`}
                                          className="max-w-md"
                                        />
                                      </div>
                                    </div>
                                   )}
                                   
                                   {/* Save & Close Button */}
                                   <div className="flex justify-end pt-2">
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
                                    <h4 className="font-medium group-hover/content:text-primary transition-colors">{item.title}</h4>
                                    {item.type === 'email' && item.emailPreheader && (
                                      <p className="text-xs text-muted-foreground italic group-hover/content:text-foreground transition-colors mb-2">
                                        {item.emailPreheader}
                                      </p>
                                    )}
                                    {item.type === 'email' ? (
                                      <div className="text-sm text-muted-foreground group-hover/content:text-foreground transition-colors">
                                        <SafeHtml content={item.caption} type="general" className="prose prose-sm max-w-none" />
                                      </div>
                                    ) : (
                                      <p className="text-sm text-muted-foreground group-hover/content:text-foreground transition-colors">{item.caption}</p>
                                    )}
                                   {item.imageUrl && (
                                     <div className="flex items-center gap-2 text-sm text-muted-foreground group-hover/content:text-foreground transition-colors">
                                       <ImageIcon className="h-4 w-4" />
                                       <span>Image selected</span>
                                     </div>
                                   )}
                                 </div>
                               )}
                            </div>
                          </div>
                        </div>
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
    </div>
  );
};