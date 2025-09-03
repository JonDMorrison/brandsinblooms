import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Calendar, Mail, MessageSquare, Facebook, Instagram, Edit, Image as ImageIcon, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { usePlanWizard } from '../PlanWizardContext';
import { PlanItem } from '../constants';
import { generateSeasonalPlanContent } from '@/services/seasonalPlanGenerator';
import { MediaSelectorImage } from '@/components/crm/MediaSelectorImage';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PlanStepCalendarProps {
  onNext: () => void;
  onBack: () => void;
}

const typeConfig = {
  email: { icon: Mail, color: 'bg-blue-500', label: 'Email' },
  sms: { icon: MessageSquare, color: 'bg-green-500', label: 'SMS' },
  facebook: { icon: Facebook, color: 'bg-blue-600', label: 'Facebook' },
  instagram: { icon: Instagram, color: 'bg-pink-500', label: 'Instagram' }
};

export const PlanStepCalendar: React.FC<PlanStepCalendarProps> = ({ onNext, onBack }) => {
  const { state, setItems, updateItem, toggleItem } = usePlanWizard();
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Generate initial seasonal content when component mounts
  useEffect(() => {
    if (state.theme && state.month && state.items.length === 0) {
      generateSeasonalPlanContent(state.theme, state.month)
        .then(generatedItems => {
          setItems(generatedItems);
        })
        .catch(error => {
          console.error('Error generating seasonal content:', error);
          // Fallback to basic items if seasonal generation fails
          setItems([]);
        });
    }
  }, [state.theme, state.month, state.items.length, setItems]);

  const handleItemUpdate = (id: string, field: keyof PlanItem, value: any) => {
    updateItem(id, { [field]: value });
  };

  const handleImageSelect = (itemId: string, imageUrl: string, metadata?: any) => {
    updateItem(itemId, { imageUrl });
  };

  // Regenerate content with AI
  const handleRegenerateWithAI = async () => {
    if (!state.theme || !state.month) return;
    
    setIsRegenerating(true);
    try {
      // Call AI content generation for enhanced content
      const response = await supabase.functions.invoke('generate_campaign_content', {
        body: {
          campaignId: `plan-${Date.now()}`,
          campaignTheme: state.theme.label,
          campaignDescription: state.theme.description,
          userId: 'plan-user',
          weekNumber: 1,
          tenantId: 'default'
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      // Regenerate content with enhanced AI-powered captions
      const enhancedItems = await generateSeasonalPlanContent(state.theme, state.month);
      
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
        const fallbackItems = await generateSeasonalPlanContent(state.theme, state.month);
        setItems(fallbackItems);
      } catch (fallbackError) {
        toast.error('Unable to regenerate content');
      }
    } finally {
      setIsRegenerating(false);
    }
  };

  // Group items by week
  const itemsByWeek = state.items.reduce((acc, item) => {
    if (!acc[item.week]) acc[item.week] = [];
    acc[item.week].push(item);
    return acc;
  }, {} as Record<number, PlanItem[]>);

  const monthName = state.month ? format(new Date(state.month), 'MMMM yyyy') : '';

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-2">
          <Calendar className="h-8 w-8 text-primary" />
          <h2 className="text-3xl font-bold">Review Your Content Calendar</h2>
        </div>
        <p className="text-muted-foreground text-lg">
          Your {state.theme?.label} content plan for {monthName}. Edit dates, captions, and toggle items on/off.
        </p>
        
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
            return (
              <Card key={weekNum} className="overflow-hidden">
                <CardHeader className="bg-muted/50">
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Week {weekNum}
                  </CardTitle>
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
                                  <div className="flex items-center gap-3 bg-muted/50 px-3 py-2 rounded-lg">
                                    <div className="flex items-center gap-2">
                                      <div className={`w-3 h-3 rounded-full ${item.enabled ? 'bg-green-500' : 'bg-gray-300'}`} />
                                      <span className={`text-sm font-medium ${item.enabled ? 'text-green-700' : 'text-gray-500'}`}>
                                        {item.enabled ? 'Active' : 'Inactive'}
                                      </span>
                                    </div>
                                    <Switch
                                      id={`toggle-${item.id}`}
                                      checked={item.enabled}
                                      onCheckedChange={() => toggleItem(item.id)}
                                      className={`${item.enabled ? 'data-[state=checked]:bg-green-500' : ''}`}
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
                                    <Label htmlFor={`caption-${item.id}`}>
                                      {item.type === 'email' ? 'Email Content' : 'Caption'}
                                    </Label>
                                    <Textarea
                                      id={`caption-${item.id}`}
                                      value={item.caption}
                                      onChange={(e) => handleItemUpdate(item.id, 'caption', e.target.value)}
                                      rows={3}
                                      className="mt-1"
                                    />
                                  </div>
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
                                <div className="space-y-3">
                                  <h4 className="font-medium">{item.title}</h4>
                                  <p className="text-sm text-muted-foreground">{item.caption}</p>
                                  {item.imageUrl && (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
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
        <Button variant="outline" onClick={onBack} size="lg" className="px-8">
          Back
        </Button>
        <Button onClick={onNext} size="lg" className="px-8">
          Review & Launch
        </Button>
      </div>
    </div>
  );
};