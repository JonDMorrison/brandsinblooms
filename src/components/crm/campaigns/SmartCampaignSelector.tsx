import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useWeeklyThemes } from '@/hooks/useWeeklyThemes';
import { useSeasonalHolidays } from '@/hooks/useSeasonalHolidays';
import { useGlobalContentData } from '@/hooks/useGlobalContentData';
import { useSearchParams } from 'react-router-dom';
import { 
  Calendar, 
  Sparkles, 
  Plus, 
  TreePine, 
  Star, 
  BookOpen,
  ArrowRight,
  Loader2
} from 'lucide-react';

interface SmartCampaignSelectorProps {
  onCampaignSelect: (campaignData: {
    name: string;
    subject_line: string;
    content?: string;
    source_type: 'weekly_theme' | 'seasonal_event' | 'custom_content' | 'new_idea';
    source_id?: string;
    ai_prompt?: string;
  }) => void;
  selectedPersona?: any;
}

export const SmartCampaignSelector: React.FC<SmartCampaignSelectorProps> = ({
  onCampaignSelect,
  selectedPersona
}) => {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [selectedType, setSelectedType] = useState<string>('');
  const [showNewIdeaModal, setShowNewIdeaModal] = useState(false);
  const [newIdeaForm, setNewIdeaForm] = useState({
    name: '',
    description: '',
    generateWithAI: false
  });
  const [loading, setLoading] = useState(false);
  
  // Data hooks
  const { themes, loading: themesLoading } = useWeeklyThemes();
  const { allHolidays, loading: holidaysLoading } = useSeasonalHolidays();
  const { userCreatedCampaigns, loading: customLoading } = useGlobalContentData();

  // Get upcoming holidays (next 90 days)
  const upcomingHolidays = allHolidays.filter(holiday => {
    const holidayDate = new Date(holiday.holiday_date);
    const now = new Date();
    const ninetyDaysFromNow = new Date();
    ninetyDaysFromNow.setDate(now.getDate() + 90);
    return holidayDate >= now && holidayDate <= ninetyDaysFromNow;
  }).slice(0, 5);

  // Get current and future weekly themes
  const availableThemes = themes.filter(theme => theme.label !== 'Past').slice(0, 3);

  // Get recent custom content
  const recentCustomContent = userCreatedCampaigns.slice(0, 3);

  // Handle URL parameters for pre-selection
  useEffect(() => {
    const source = searchParams.get('source');
    const holidayId = searchParams.get('holiday_id');
    const holidayName = searchParams.get('holiday_name');
    
    if (source === 'seasonal_event' && holidayId && holidayName) {
      const holiday = allHolidays.find(h => h.id === holidayId);
      if (holiday) {
        handleTypeSelection('seasonal_event', holiday);
      }
    }
  }, [searchParams, allHolidays]);

  const handleTypeSelection = (type: string, data?: any) => {
    setSelectedType(type);
    
    switch (type) {
      case 'weekly_theme':
        if (data) {
          onCampaignSelect({
            name: data.title,
            subject_line: `🌱 ${data.title}`,
            source_type: 'weekly_theme',
            source_id: data.id,
            ai_prompt: `Write a garden center email campaign about ${data.title}. ${data.description}. ${selectedPersona ? `Target audience: ${selectedPersona.name} - ${selectedPersona.description}. Use a ${selectedPersona.tone} tone.` : 'Use a friendly, professional tone.'}`
          });
          toast({
            title: "Weekly theme selected",
            description: "Campaign details auto-filled from theme"
          });
        }
        break;
        
      case 'seasonal_event':
        if (data) {
          onCampaignSelect({
            name: `${data.holiday_name} Campaign`,
            subject_line: `🎄 ${data.holiday_name} Special`,
            source_type: 'seasonal_event',
            source_id: data.id,
            ai_prompt: `Write a garden center email campaign for ${data.holiday_name}. ${data.description || 'Focus on seasonal relevance and garden center products.'}. ${selectedPersona ? `Target audience: ${selectedPersona.name} - ${selectedPersona.description}. Use a ${selectedPersona.tone} tone.` : 'Use a friendly, professional tone.'}`
          });
          toast({
            title: "Seasonal event selected",
            description: "Campaign details auto-filled from holiday"
          });
        }
        break;
        
      case 'custom_content':
        if (data) {
          onCampaignSelect({
            name: `${data.title} - CRM Campaign`,
            subject_line: `🌿 ${data.title}`,
            content: data.description || '',
            source_type: 'custom_content',
            source_id: data.id
          });
          toast({
            title: "Custom content imported",
            description: "Content imported from your dashboard"
          });
        }
        break;
        
      case 'new_idea':
        setShowNewIdeaModal(true);
        break;
    }
  };

  const handleNewIdeaSubmit = async () => {
    if (!newIdeaForm.name.trim()) {
      toast({
        title: "Error",
        description: "Campaign name is required",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Save to dashboard (sync back)
      const campaignData = {
        title: newIdeaForm.name,
        description: newIdeaForm.description,
        theme: 'Custom CRM Campaign',
        prompt: newIdeaForm.description,
        source: 'crm_created',
        week_number: Math.ceil(new Date().getTime() / (1000 * 60 * 60 * 24 * 7)) % 52 + 1,
        start_date: new Date().toISOString().split('T')[0]
      };

      const { error } = await supabase
        .from('campaigns')
        .insert(campaignData);

      if (error) throw error;

      // Prepare campaign for CRM
      const crmCampaignData: {
        name: string;
        subject_line: string;
        content?: string;
        source_type: 'new_idea';
        ai_prompt?: string;
      } = {
        name: newIdeaForm.name,
        subject_line: `✨ ${newIdeaForm.name}`,
        content: newIdeaForm.description,
        source_type: 'new_idea' as const
      };

      if (newIdeaForm.generateWithAI) {
        crmCampaignData.ai_prompt = `Write a garden center email campaign about: ${newIdeaForm.description}. ${selectedPersona ? `Target audience: ${selectedPersona.name} - ${selectedPersona.description}. Use a ${selectedPersona.tone} tone.` : 'Use a friendly, professional tone.'}`;
      }

      onCampaignSelect(crmCampaignData);
      
      setShowNewIdeaModal(false);
      setNewIdeaForm({ name: '', description: '', generateWithAI: false });
      
      toast({
        title: "New campaign idea created",
        description: "Synced to your dashboard and ready for CRM"
      });
    } catch (error) {
      console.error('Error creating new idea:', error);
      toast({
        title: "Error",
        description: "Failed to create new campaign idea",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-base font-medium flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Smart Campaign Selector *
          <span className="text-xs text-muted-foreground font-normal ml-1">
            (Choose from themes, events, or create new)
          </span>
        </Label>
        
        <Select value={selectedType} onValueChange={setSelectedType}>
          <SelectTrigger className="h-12">
            <SelectValue placeholder="Choose a campaign source..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="weekly_theme">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-green-600" />
                Weekly Theme ({availableThemes.length} available)
              </div>
            </SelectItem>
            <SelectItem value="seasonal_event">
              <div className="flex items-center gap-2">
                <TreePine className="h-4 w-4 text-red-600" />
                Seasonal Events ({upcomingHolidays.length} upcoming)
              </div>
            </SelectItem>
            <SelectItem value="custom_content">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-blue-600" />
                Your Custom Content ({recentCustomContent.length} recent)
              </div>
            </SelectItem>
            <SelectItem value="new_idea">
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-purple-600" />
                Create New Idea
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Dynamic Content Cards */}
      {selectedType === 'weekly_theme' && (
        <Card className="border-green-200 bg-green-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="h-4 w-4 text-green-600" />
              Available Weekly Themes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {themesLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Loading themes...
              </div>
            ) : availableThemes.length > 0 ? (
              availableThemes.map((theme) => (
                <div
                  key={theme.id}
                  className="p-3 bg-white border border-green-200 rounded-lg hover:border-green-400 cursor-pointer transition-colors"
                  onClick={() => handleTypeSelection('weekly_theme', theme)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">{theme.title}</h4>
                      <p className="text-xs text-muted-foreground mt-1">{theme.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-xs">
                          Week {theme.weekNumber}
                        </Badge>
                        {theme.label && (
                          <Badge variant={theme.label === 'Current' ? 'default' : 'secondary'} className="text-xs">
                            {theme.label}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-green-600 flex-shrink-0" />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground py-2">No weekly themes available</p>
            )}
          </CardContent>
        </Card>
      )}

      {selectedType === 'seasonal_event' && (
        <Card className="border-red-200 bg-red-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TreePine className="h-4 w-4 text-red-600" />
              Upcoming Seasonal Events
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {holidaysLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Loading events...
              </div>
            ) : upcomingHolidays.length > 0 ? (
              upcomingHolidays.map((holiday) => (
                <div
                  key={holiday.id}
                  className="p-3 bg-white border border-red-200 rounded-lg hover:border-red-400 cursor-pointer transition-colors"
                  onClick={() => handleTypeSelection('seasonal_event', holiday)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">{holiday.holiday_name}</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDate(holiday.holiday_date)} • {holiday.description || 'Seasonal marketing opportunity'}
                      </p>
                      {holiday.garden_relevance && (
                        <Badge variant="outline" className="text-xs mt-2">
                          {holiday.garden_relevance}
                        </Badge>
                      )}
                    </div>
                    <ArrowRight className="h-4 w-4 text-red-600 flex-shrink-0" />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground py-2">No upcoming seasonal events</p>
            )}
          </CardContent>
        </Card>
      )}

      {selectedType === 'custom_content' && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-blue-600" />
              Your Custom Content
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {customLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Loading content...
              </div>
            ) : recentCustomContent.length > 0 ? (
              recentCustomContent.map((content) => (
                <div
                  key={content.id}
                  className="p-3 bg-white border border-blue-200 rounded-lg hover:border-blue-400 cursor-pointer transition-colors"
                  onClick={() => handleTypeSelection('custom_content', content)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">{content.title}</h4>
                      <p className="text-xs text-muted-foreground mt-1">{content.description}</p>
                      <Badge variant="outline" className="text-xs mt-2">
                        Dashboard Content
                      </Badge>
                    </div>
                    <ArrowRight className="h-4 w-4 text-blue-600 flex-shrink-0" />
                  </div>
                </div>
              ))
            ) : (
              <div className="py-2">
                <p className="text-sm text-muted-foreground">No custom content available</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => window.open('/dashboard', '_blank')}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Create in Dashboard
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {selectedType === 'new_idea' && (
        <Card className="border-purple-200 bg-purple-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Plus className="h-4 w-4 text-purple-600" />
              Create New Campaign Idea
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => setShowNewIdeaModal(true)}
              className="w-full bg-purple-600 hover:bg-purple-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Start New Campaign Idea
            </Button>
          </CardContent>
        </Card>
      )}

      {/* New Idea Modal */}
      <Dialog open={showNewIdeaModal} onOpenChange={setShowNewIdeaModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-purple-600" />
              Create New Campaign Idea
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="idea-name">Campaign Name *</Label>
              <Input
                id="idea-name"
                value={newIdeaForm.name}
                onChange={(e) => setNewIdeaForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Summer Drought Solutions"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="idea-description">Description (optional)</Label>
              <Input
                id="idea-description"
                value={newIdeaForm.description}
                onChange={(e) => setNewIdeaForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description or notes..."
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="generate-ai"
                checked={newIdeaForm.generateWithAI}
                onChange={(e) => setNewIdeaForm(prev => ({ ...prev, generateWithAI: e.target.checked }))}
                className="rounded border-gray-300"
              />
              <Label htmlFor="generate-ai" className="text-sm">
                Generate content with AI after creation
              </Label>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-800">
                💡 <strong>Sync Feature:</strong> This idea will be saved to your Dashboard and tagged as "Imported from CRM" for future use.
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleNewIdeaSubmit}
                disabled={loading}
                className="flex-1"
              >
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Star className="h-4 w-4 mr-2" />}
                Create & Use
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowNewIdeaModal(false)}
                disabled={loading}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};