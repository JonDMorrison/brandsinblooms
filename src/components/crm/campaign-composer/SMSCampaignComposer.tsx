import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
  MessageSquare,
  Loader2,
  Smartphone,
  AlertTriangle,
  Phone,
  Shield
} from 'lucide-react';
import { SMSPreview } from './SMSPreview';

interface Segment {
  id: string;
  name: string;
  customer_count: number;
  sms_eligible_count?: number;
}

interface CampaignData {
  name: string;
  message: string;
  segment_id: string;
  status: 'draft' | 'scheduled' | 'sent';
  scheduled_at?: string;
  image_url?: string;
}

export const SMSCampaignComposer: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<Date>();
  const [scheduledTime, setScheduledTime] = useState('09:00');
  const [smsEligibleCount, setSmsEligibleCount] = useState(0);
  
  // Form data
  const [campaignData, setCampaignData] = useState<CampaignData>({
    name: '',
    message: '',
    segment_id: '',
    status: 'draft'
  });

  const MAX_CHARS = 160;
  const remainingChars = MAX_CHARS - campaignData.message.length;
  const isOverLimit = remainingChars < 0;

  // SMS templates
  const SMS_TEMPLATES = {
    invite: "🌱 Want plant tips and early deals via text? Reply YES to join our garden community!",
    welcome: "Welcome to our garden family! 🌿 Get ready for exclusive plant care tips and special offers.",
    sale: "🌸 Spring Sale Alert! 25% off all flowering plants this weekend. Show this text in-store!",
    tips: "💡 Garden Tip: Water your plants in the morning to reduce evaporation and prevent disease. Happy gardening!",
    reminder: "🗓️ Don't forget! Your pre-ordered plants are ready for pickup at our garden center."
  };

  useEffect(() => {
    if (user) {
      loadSegments();
      
      // Check for template parameter
      const templateParam = searchParams.get('template');
      if (templateParam && SMS_TEMPLATES[templateParam as keyof typeof SMS_TEMPLATES]) {
        setCampaignData(prev => ({
          ...prev,
          name: `SMS ${templateParam.charAt(0).toUpperCase() + templateParam.slice(1)} Campaign`,
          message: SMS_TEMPLATES[templateParam as keyof typeof SMS_TEMPLATES]
        }));
      }
    }
  }, [user, searchParams]);

  useEffect(() => {
    if (campaignData.segment_id) {
      fetchSmsEligibleCount(campaignData.segment_id);
    }
  }, [campaignData.segment_id]);

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

  const fetchSmsEligibleCount = async (segmentId: string) => {
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user?.id)
        .single();

      if (userData?.tenant_id) {
        // Get customers in segment who have opted in for SMS
        const { data, error } = await supabase
          .from('crm_customers')
          .select('id', { count: 'exact' })
          .eq('tenant_id', userData.tenant_id)
          .eq('sms_opt_in', true);

        if (error) throw error;
        setSmsEligibleCount(data?.length || 0);
      }
    } catch (error) {
      console.error('Error fetching SMS eligible count:', error);
      setSmsEligibleCount(0);
    }
  };

  const generateAIContent = async () => {
    if (!campaignData.segment_id) {
      toast({
        title: "Select Segment First",
        description: "Please select a target segment before generating content",
        variant: "destructive"
      });
      return;
    }

    setAiGenerating(true);
    try {
      const selectedSegment = segments.find(s => s.id === campaignData.segment_id);
      
      const { data, error } = await supabase.functions.invoke('generate-sms', {
        body: {
          segment_name: selectedSegment?.name,
          current_message: campaignData.message,
          business_type: 'garden center',
          max_chars: MAX_CHARS
        }
      });

      if (error) throw error;

      if (data?.message) {
        setCampaignData(prev => ({ ...prev, message: data.message }));
        toast({
          title: "Content Generated!",
          description: "AI has generated SMS content for your campaign"
        });
      }
    } catch (error) {
      console.error('Error generating AI content:', error);
      toast({
        title: "Error",
        description: "Failed to generate AI content",
        variant: "destructive"
      });
    } finally {
      setAiGenerating(false);
    }
  };

  const saveCampaign = async (sendNow = false) => {
    if (!campaignData.name || !campaignData.message || !campaignData.segment_id) {
      toast({
        title: "Missing Information",
        description: "Please fill in campaign name, message, and select a segment",
        variant: "destructive"
      });
      return;
    }

    if (isOverLimit) {
      toast({
        title: "Message Too Long",
        description: `Your message is ${Math.abs(remainingChars)} characters over the limit`,
        variant: "destructive"
      });
      return;
    }

    if (smsEligibleCount === 0) {
      toast({
        title: "No SMS Recipients",
        description: "The selected segment has no customers who have opted in for SMS",
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

      if (!userData?.tenant_id) return;

      let scheduled_at = null;
      
      if (!sendNow && scheduledDate && scheduledTime) {
        const [hours, minutes] = scheduledTime.split(':').map(Number);
        const datetime = new Date(scheduledDate);
        datetime.setHours(hours, minutes, 0, 0);
        scheduled_at = datetime.toISOString();
      }

      // Add compliance footer
      const messageWithFooter = campaignData.message + '\n\nReply STOP to unsubscribe';

      const campaignToSave = {
        name: campaignData.name,
        message: messageWithFooter,
        segment_id: campaignData.segment_id,
        status: sendNow ? 'sent' : (scheduled_at ? 'scheduled' : 'draft'),
        scheduled_at,
        tenant_id: userData.tenant_id,
        user_id: user?.id,
        image_url: campaignData.image_url || null
      };

      const { data: savedCampaign, error } = await supabase
        .from('crm_sms_campaigns')
        .insert(campaignToSave)
        .select()
        .single();

      if (error) throw error;

      // If sending now, call the send function
      if (sendNow) {
        const { error: sendError } = await supabase.functions.invoke('send-sms-campaign', {
          body: { campaign_id: savedCampaign.id }
        });

        if (sendError) throw sendError;
      }

      toast({
        title: sendNow ? "SMS Campaign Sent!" : "Campaign Saved!",
        description: sendNow 
          ? `Your SMS has been sent to ${smsEligibleCount} recipients` 
          : "Your campaign has been saved and can be sent later"
      });

      navigate('/crm/sms-campaigns');
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

  const selectedSegment = segments.find(s => s.id === campaignData.segment_id);

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/crm/sms-campaigns')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to SMS Campaigns
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">SMS Campaign Composer</h1>
            <p className="text-muted-foreground">Create engaging SMS campaigns for your garden center customers</p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowPreview(true)}>
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          <Button variant="outline" onClick={() => saveCampaign(false)} disabled={loading}>
            <Save className="h-4 w-4 mr-2" />
            Save Draft
          </Button>
          <Button 
            onClick={() => saveCampaign(true)} 
            disabled={loading || isOverLimit || !campaignData.message || smsEligibleCount === 0}
          >
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Send SMS
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Settings Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-blue-600" />
                Campaign Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Campaign Name</Label>
                <Input
                  value={campaignData.name}
                  onChange={(e) => setCampaignData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Spring Plant Sale SMS"
                />
              </div>
              
              <div>
                <Label>Target Segment</Label>
                <Select 
                  value={campaignData.segment_id} 
                  onValueChange={(value) => setCampaignData(prev => ({ ...prev, segment_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select segment..." />
                  </SelectTrigger>
                  <SelectContent>
                    {segments.map(segment => (
                      <SelectItem key={segment.id} value={segment.id}>
                        {segment.name} ({segment.customer_count} customers)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {selectedSegment && (
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>{selectedSegment.customer_count} total customers</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-green-600" />
                      <span className="text-green-600 font-medium">
                        {smsEligibleCount} SMS-eligible recipients
                      </span>
                    </div>
                    
                    {smsEligibleCount === 0 && (
                      <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          No customers in this segment have opted in for SMS. Consider sending an SMS invite campaign first.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}
              </div>

              <Separator />

              <div>
                <Label>Schedule (Optional)</Label>
                <div className="space-y-2">
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
                        {scheduledDate ? format(scheduledDate, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={scheduledDate}
                        onSelect={setScheduledDate}
                        initialFocus
                        disabled={(date) => date < new Date()}
                      />
                    </PopoverContent>
                  </Popover>
                  
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <Input
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Templates */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Templates</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(SMS_TEMPLATES).map(([key, template]) => (
                  <Button
                    key={key}
                    variant="outline"
                    size="sm"
                    className="w-full justify-start text-left h-auto py-3"
                    onClick={() => setCampaignData(prev => ({ 
                      ...prev, 
                      message: template,
                      name: prev.name || `SMS ${key.charAt(0).toUpperCase() + key.slice(1)} Campaign`
                    }))}
                  >
                    <div>
                      <div className="font-medium capitalize">{key} Template</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {template.substring(0, 40)}...
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content - SMS Composer */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>SMS Message</span>
                <Badge 
                  variant={isOverLimit ? "destructive" : remainingChars < 20 ? "secondary" : "default"}
                >
                  {remainingChars} characters remaining
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="relative">
                  <Textarea
                    value={campaignData.message}
                    onChange={(e) => setCampaignData(prev => ({ ...prev, message: e.target.value }))}
                    placeholder="Write your SMS message here... Keep it short and engaging!"
                    rows={4}
                    className={cn(
                      "resize-none",
                      isOverLimit && "border-red-500 focus:border-red-500"
                    )}
                  />
                  
                  <div className="absolute bottom-3 right-3 flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={generateAIContent}
                      disabled={aiGenerating || !campaignData.segment_id}
                    >
                      {aiGenerating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      AI Generate
                    </Button>
                  </div>
                </div>

                {isOverLimit && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Your message is {Math.abs(remainingChars)} characters over the {MAX_CHARS} character limit. 
                      Long messages may be split into multiple texts or truncated.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="text-sm text-muted-foreground">
                  <Shield className="h-4 w-4 inline mr-1" />
                  "Reply STOP to unsubscribe" will be automatically added to comply with SMS regulations.
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Live Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-gray-600" />
                SMS Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center">
                <div className="w-64 h-96 bg-gray-900 rounded-3xl p-4 shadow-2xl">
                  <div className="w-full h-full bg-gray-100 rounded-2xl p-4 overflow-y-auto">
                    <div className="space-y-2">
                      {/* Contact header */}
                      <div className="text-center text-xs text-gray-500 mb-4">
                        Garden Center
                      </div>
                      
                      {/* Message bubble */}
                      <div className="bg-blue-500 text-white rounded-2xl rounded-bl-md px-4 py-2 max-w-[85%] ml-auto">
                        <div className="text-sm break-words">
                          {campaignData.message || 'Your SMS message will appear here...'}
                          {campaignData.message && (
                            <div className="text-xs opacity-80 mt-1 border-t border-blue-400 pt-1">
                              Reply STOP to unsubscribe
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-xs text-gray-500 text-right">
                        Delivered
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Preview Modal */}
      <SMSPreview
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        message={campaignData.message}
        segmentName={selectedSegment?.name || ''}
        recipientCount={smsEligibleCount}
      />
    </div>
  );
};