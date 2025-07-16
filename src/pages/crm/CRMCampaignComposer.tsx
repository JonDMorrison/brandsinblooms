import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SubscriptionGate } from '@/components/SubscriptionGate';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { 
  ArrowLeft,
  Send,
  Save,
  Sparkles,
  Eye,
  Calendar as CalendarIcon,
  Clock,
  Users,
  Mail,
  Loader2,
  Lightbulb
} from 'lucide-react';

interface Segment {
  id: string;
  name: string;
  customer_count: number;
}

const CRMCampaignComposer = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<Date>();
  
  // Subject line AI states
  const [showSubjectSuggestions, setShowSubjectSuggestions] = useState(false);
  const [subjectSuggestions, setSubjectSuggestions] = useState<string[]>([]);
  const [subjectGenerating, setSubjectGenerating] = useState(false);
  const [subjectTopic, setSubjectTopic] = useState('');
  
  // Form data
  const [formData, setFormData] = useState({
    name: '',
    subject_line: '',
    content: '',
    segment_id: '',
    status: 'draft' as 'draft' | 'scheduled' | 'sent'
  });
  
  const [aiPrompt, setAiPrompt] = useState('');

  useEffect(() => {
    if (user) {
      loadSegments();
    }
  }, [user]);

  const loadSegments = async () => {
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user?.id)
        .single();

      if (userData?.tenant_id) {
        const { data, error } = await supabase
          .from('crm_segments')
          .select('id, name, customer_count')
          .eq('tenant_id', userData.tenant_id)
          .order('name');

        if (error) throw error;
        setSegments(data || []);
      }
    } catch (error) {
      console.error('Error loading segments:', error);
      toast({
        title: "Error",
        description: "Failed to load segments",
        variant: "destructive"
      });
    }
  };

  const generateWithAI = async () => {
    if (!aiPrompt.trim()) {
      toast({
        title: "Error",
        description: "Please enter a prompt for AI generation",
        variant: "destructive"
      });
      return;
    }

    setAiGenerating(true);
    try {
      const response = await fetch('/functions/v1/generate-campaign-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({
          prompt: aiPrompt,
          context: 'garden center email campaign'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate content');
      }

      const { content } = await response.json();
      setFormData(prev => ({ ...prev, content }));
      setShowAIModal(false);
      setAiPrompt('');
      
      toast({
        title: "Success",
        description: "Content generated successfully!"
      });
    } catch (error) {
      console.error('Error generating content:', error);
      toast({
        title: "Error",
        description: "Failed to generate content with AI",
        variant: "destructive"
      });
    } finally {
      setAiGenerating(false);
    }
  };

  const generateSubjectLines = async () => {
    setSubjectGenerating(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const response = await supabase.functions.invoke('generate-subject-lines', {
        body: {
          topic: subjectTopic || undefined,
          content: formData.content || undefined
        }
      });

      if (response.error) {
        throw response.error;
      }

      const { subjectLines } = response.data;
      setSubjectSuggestions(subjectLines || []);
      setShowSubjectSuggestions(true);
      
      toast({
        title: "Success",
        description: "Subject line suggestions generated!"
      });
    } catch (error) {
      console.error('Error generating subject lines:', error);
      toast({
        title: "Error",
        description: "Failed to generate subject line suggestions",
        variant: "destructive"
      });
    } finally {
      setSubjectGenerating(false);
    }
  };

  const selectSubjectLine = (subjectLine: string) => {
    setFormData(prev => ({ ...prev, subject_line: subjectLine }));
    setShowSubjectSuggestions(false);
    setSubjectTopic('');
    toast({
      title: "Subject line selected",
      description: "Subject line has been updated"
    });
  };

  const saveCampaign = async (status: 'draft' | 'scheduled' | 'sent' = 'draft') => {
    if (!formData.name.trim() || !formData.subject_line.trim()) {
      toast({
        title: "Error",
        description: "Campaign name and subject line are required",
        variant: "destructive"
      });
      return;
    }

    if (!formData.segment_id) {
      toast({
        title: "Error", 
        description: "Please select a customer segment",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user?.id)
        .single();

      if (!userData?.tenant_id) {
        throw new Error('No tenant found');
      }

      const campaignData = {
        name: formData.name,
        subject_line: formData.subject_line,
        content: formData.content,
        segment_id: formData.segment_id,
        status,
        scheduled_at: status === 'scheduled' && scheduledDate ? scheduledDate.toISOString() : null,
        sent_at: status === 'sent' ? new Date().toISOString() : null,
        tenant_id: userData.tenant_id,
        user_id: user?.id,
        metrics: { emails_sent: 0, opens: 0, clicks: 0, bounces: 0 }
      };

      const { error } = await supabase
        .from('crm_campaigns')
        .insert(campaignData);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Campaign ${status === 'draft' ? 'saved as draft' : status === 'scheduled' ? 'scheduled' : 'sent'} successfully!`
      });

      navigate('/crm/campaigns');
    } catch (error) {
      console.error('Error saving campaign:', error);
      toast({
        title: "Error",
        description: "Failed to save campaign",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const sendNow = async () => {
    await saveCampaign('sent');
  };

  const scheduleForLater = async () => {
    if (!scheduledDate) {
      toast({
        title: "Error",
        description: "Please select a date and time to schedule",
        variant: "destructive"
      });
      return;
    }
    await saveCampaign('scheduled');
  };

  const selectedSegment = segments.find(s => s.id === formData.segment_id);

  return (
    <SubscriptionGate requiredPlan="bloom" feature="Email Campaigns">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/crm/campaigns')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Create Campaign</h1>
              <p className="text-muted-foreground">
                Design and send targeted emails to your customers
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={formData.status === 'draft' ? 'secondary' : 'default'}>
              {formData.status === 'draft' ? 'Draft' : formData.status === 'scheduled' ? 'Scheduled' : 'Sent'}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Campaign Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Campaign Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Campaign Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Spring Garden Prep Newsletter"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject Line *</Label>
                  <div className="flex gap-2">
                    <Input
                      id="subject"
                      value={formData.subject_line}
                      onChange={(e) => setFormData(prev => ({ ...prev, subject_line: e.target.value }))}
                      placeholder="e.g., 🌱 Get Your Garden Spring-Ready!"
                      className="flex-1"
                    />
                    <Dialog open={showSubjectSuggestions} onOpenChange={setShowSubjectSuggestions}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="shrink-0">
                          <Lightbulb className="h-4 w-4 mr-1" />
                          ✨ Suggest
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Subject Line Suggestions</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="subject-topic">What's this email about? (optional)</Label>
                            <Input
                              id="subject-topic"
                              value={subjectTopic}
                              onChange={(e) => setSubjectTopic(e.target.value)}
                              placeholder="e.g., Spring planting tips, summer watering guide..."
                            />
                            <p className="text-sm text-muted-foreground">
                              Leave blank to use your email content for suggestions
                            </p>
                          </div>
                          
                          <div className="flex gap-2">
                            <Button 
                              onClick={generateSubjectLines} 
                              disabled={subjectGenerating}
                              className="flex-1"
                            >
                              {subjectGenerating ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <Lightbulb className="h-4 w-4 mr-2" />
                              )}
                              Generate Suggestions
                            </Button>
                            <Button variant="outline" onClick={() => setShowSubjectSuggestions(false)}>
                              Cancel
                            </Button>
                          </div>

                          {subjectSuggestions.length > 0 && (
                            <div className="space-y-2">
                              <Label>Select a suggestion:</Label>
                              <div className="space-y-2">
                                {subjectSuggestions.map((suggestion, index) => (
                                  <div
                                    key={index}
                                    className="p-3 border border-muted rounded-lg hover:border-garden-green hover:bg-muted/50 cursor-pointer transition-colors"
                                    onClick={() => selectSubjectLine(suggestion)}
                                  >
                                    <div className="font-medium">{suggestion}</div>
                                    <div className="text-sm text-muted-foreground">
                                      {suggestion.length} characters
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <Button 
                                variant="ghost" 
                                onClick={generateSubjectLines}
                                disabled={subjectGenerating}
                                className="w-full"
                              >
                                {subjectGenerating ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <Lightbulb className="h-4 w-4 mr-2" />
                                )}
                                Regenerate Suggestions
                              </Button>
                            </div>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="segment">Customer Segment *</Label>
                  <Select 
                    value={formData.segment_id} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, segment_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a segment" />
                    </SelectTrigger>
                    <SelectContent>
                      {segments.map((segment) => (
                        <SelectItem key={segment.id} value={segment.id}>
                          <div className="flex items-center justify-between w-full">
                            <span>{segment.name}</span>
                            <span className="text-muted-foreground ml-2">
                              {segment.customer_count} customers
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Email Content Editor */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Email Content</CardTitle>
                  <div className="flex gap-2">
                    <Dialog open={showAIModal} onOpenChange={setShowAIModal}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Sparkles className="h-4 w-4 mr-2" />
                          Generate With AI
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Generate Content with AI</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="ai-prompt">What should this email be about?</Label>
                            <Textarea
                              id="ai-prompt"
                              value={aiPrompt}
                              onChange={(e) => setAiPrompt(e.target.value)}
                              placeholder="e.g., Spring planting tips for new gardeners, summer watering schedule, fall cleanup checklist..."
                              rows={4}
                            />
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setShowAIModal(false)}>
                              Cancel
                            </Button>
                            <Button onClick={generateWithAI} disabled={aiGenerating}>
                              {aiGenerating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                              Generate Content
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                    
                    <Dialog open={showPreview} onOpenChange={setShowPreview}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4 mr-2" />
                          Preview
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Email Preview</DialogTitle>
                        </DialogHeader>
                        <div className="border rounded-lg p-4 bg-white">
                          <div className="border-b pb-4 mb-4">
                            <div className="text-sm text-muted-foreground">Subject:</div>
                            <div className="font-semibold">{formData.subject_line || 'No subject line'}</div>
                          </div>
                          <div className="prose max-w-none">
                            {formData.content ? (
                              <div dangerouslySetInnerHTML={{ __html: formData.content.replace(/\n/g, '<br>') }} />
                            ) : (
                              <p className="text-muted-foreground italic">No content yet</p>
                            )}
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={formData.content}
                  onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Write your email content here..."
                  rows={12}
                  className="resize-none"
                />
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Segment Info */}
            {selectedSegment && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Selected Segment
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="font-medium">{selectedSegment.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {selectedSegment.customer_count} customers will receive this email
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Schedule & Send */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Schedule & Send
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Send Date & Time (optional)</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !scheduledDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {scheduledDate ? format(scheduledDate, "PPP 'at' p") : "Pick a date & time"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={scheduledDate}
                        onSelect={setScheduledDate}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Button 
                    onClick={sendNow} 
                    className="w-full" 
                    disabled={loading || !formData.segment_id}
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Send Now
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    onClick={scheduleForLater} 
                    className="w-full"
                    disabled={loading || !scheduledDate}
                  >
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    Schedule for Later
                  </Button>
                  
                  <Button 
                    variant="ghost" 
                    onClick={() => saveCampaign('draft')} 
                    className="w-full"
                    disabled={loading}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save as Draft
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Email Tips */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email Tips
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <div className="font-medium">Perfect Subject Lines</div>
                  <div className="text-muted-foreground">Use emojis and keep under 50 characters</div>
                </div>
                <div>
                  <div className="font-medium">Best Send Times</div>
                  <div className="text-muted-foreground">Tuesday-Thursday, 9-11 AM</div>
                </div>
                <div>
                  <div className="font-medium">Garden Content</div>
                  <div className="text-muted-foreground">Include seasonal tips and plant care advice</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </SubscriptionGate>
  );
};

export default CRMCampaignComposer;