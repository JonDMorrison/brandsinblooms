import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MessageSquare, Calendar as CalendarIcon, Clock, Send, Save, Sparkles, Eye, Upload, Smartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface Segment {
  id: string;
  name: string;
  customer_count: number;
  sms_eligible_count?: number;
}

export default function CRMSMSCampaignComposer() {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [selectedSegment, setSelectedSegment] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [scheduledDate, setScheduledDate] = useState<Date>();
  const [scheduledTime, setScheduledTime] = useState("");
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [showAiDialog, setShowAiDialog] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [smsEligibleCount, setSmsEligibleCount] = useState(0);
  
  const { toast } = useToast();
  const navigate = useNavigate();

  const MAX_CHARS = 300;
  const remainingChars = MAX_CHARS - message.length;

  useEffect(() => {
    fetchSegments();
  }, []);

  useEffect(() => {
    if (selectedSegment) {
      fetchSmsEligibleCount(selectedSegment);
    }
  }, [selectedSegment]);

  const fetchSegments = async () => {
    try {
      const { data, error } = await supabase
        .from("crm_segments")
        .select("*")
        .order("name");

      if (error) throw error;
      setSegments(data || []);
    } catch (error) {
      console.error("Error fetching segments:", error);
      toast({
        title: "Error",
        description: "Failed to load customer segments",
        variant: "destructive",
      });
    }
  };

  const fetchSmsEligibleCount = async (segmentId: string) => {
    try {
      const { data, error } = await supabase
        .from("crm_customers")
        .select("id", { count: "exact" })
        .eq("sms_opt_in", true);

      if (error) throw error;
      setSmsEligibleCount(data?.length || 0);
    } catch (error) {
      console.error("Error fetching SMS eligible count:", error);
      setSmsEligibleCount(0);
    }
  };

  const generateAIContent = async () => {
    if (!aiPrompt.trim()) {
      toast({
        title: "Error",
        description: "Please enter a prompt for AI generation",
        variant: "destructive",
      });
      return;
    }

    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-campaign-content", {
        body: {
          prompt: aiPrompt,
          type: "sms",
          maxLength: MAX_CHARS - 50 // Leave room for opt-out message
        },
      });

      if (error) throw error;

      if (data?.content) {
        setMessage(data.content);
        setShowAiDialog(false);
        setAiPrompt("");
        toast({
          title: "Success",
          description: "AI content generated successfully",
        });
      }
    } catch (error) {
      console.error("Error generating content:", error);
      toast({
        title: "Error",
        description: "Failed to generate AI content",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const saveCampaign = async (status: "draft" | "scheduled" | "sending") => {
    if (!name.trim() || !message.trim() || !selectedSegment) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (smsEligibleCount === 0) {
      toast({
        title: "Warning",
        description: "No SMS-eligible customers in selected segment",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      let scheduledAt = null;
      if (status === "scheduled" && scheduledDate && scheduledTime) {
        const [hours, minutes] = scheduledTime.split(':');
        const scheduled = new Date(scheduledDate);
        scheduled.setHours(parseInt(hours), parseInt(minutes));
        scheduledAt = scheduled.toISOString();
      }

      // Add opt-out footer if not already present
      const finalMessage = message.includes("Reply STOP") 
        ? message 
        : `${message}\n\nReply STOP to unsubscribe.`;

      const campaignData = {
        name: name.trim(),
        message: finalMessage,
        segment_id: selectedSegment,
        image_url: imageUrl || null,
        status,
        scheduled_at: scheduledAt,
      };

      const { data, error } = await supabase
        .from("crm_sms_campaigns")
        .insert(campaignData)
        .select()
        .single();

      if (error) throw error;

      if (status === "sending") {
        // Send immediately
        const { error: sendError } = await supabase.functions.invoke("send-sms-campaign", {
          body: { campaignId: data.id },
        });

        if (sendError) {
          toast({
            title: "Campaign Created",
            description: "Campaign saved but failed to send. You can retry from the campaigns list.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Success",
            description: "SMS campaign sent successfully!",
          });
        }
      } else {
        toast({
          title: "Success",
          description: `Campaign ${status === "draft" ? "saved as draft" : "scheduled"} successfully`,
        });
      }

      navigate("/crm/sms-campaigns");
    } catch (error) {
      console.error("Error saving campaign:", error);
      toast({
        title: "Error",
        description: "Failed to save campaign",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const selectedSegmentData = segments.find(s => s.id === selectedSegment);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Create SMS Campaign</h1>
        <p className="text-muted-foreground mt-2">
          Send promotional texts to your opted-in customers
        </p>
      </div>

      <div className="grid gap-6">
        {/* Campaign Setup */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <MessageSquare className="h-5 w-5 mr-2" />
              Campaign Setup
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Campaign Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter campaign name..."
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="segment">Customer Segment *</Label>
              <Select value={selectedSegment} onValueChange={setSelectedSegment}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Choose a segment..." />
                </SelectTrigger>
                <SelectContent>
                  {segments.map((segment) => (
                    <SelectItem key={segment.id} value={segment.id}>
                      <div className="flex items-center justify-between w-full">
                        <span>{segment.name}</span>
                        <span className="text-muted-foreground ml-2">
                          ({segment.customer_count || 0} customers)
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedSegmentData && (
                <p className="text-sm text-muted-foreground mt-1">
                  {smsEligibleCount} SMS-eligible customers in this segment
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="imageUrl">Image URL (Optional)</Label>
              <Input
                id="imageUrl"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
                className="mt-1"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Add an image for MMS campaigns
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Message Editor */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center">
                <Smartphone className="h-5 w-5 mr-2" />
                Message Editor
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPreview(true)}
                  disabled={!message.trim()}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAiDialog(true)}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate with AI
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="message">Message Content *</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, MAX_CHARS))}
                placeholder="Enter your SMS message..."
                className="mt-1 min-h-[120px]"
                maxLength={MAX_CHARS}
              />
              <div className="flex justify-between items-center mt-2">
                <p className="text-sm text-muted-foreground">
                  Auto-includes: "Reply STOP to unsubscribe."
                </p>
                <span className={cn(
                  "text-sm",
                  remainingChars < 20 ? "text-destructive" : "text-muted-foreground"
                )}>
                  {remainingChars} characters remaining
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Schedule & Send */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Clock className="h-5 w-5 mr-2" />
              Schedule & Send
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Schedule Date (Optional)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal mt-1",
                        !scheduledDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {scheduledDate ? format(scheduledDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={scheduledDate}
                      onSelect={setScheduledDate}
                      disabled={(date) => date < new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <Label htmlFor="time">Schedule Time</Label>
                <Input
                  id="time"
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="mt-1"
                  disabled={!scheduledDate}
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => saveCampaign("draft")}
                disabled={loading}
              >
                <Save className="h-4 w-4 mr-2" />
                Save as Draft
              </Button>

              <div className="space-x-2">
                {scheduledDate && scheduledTime && (
                  <Button
                    onClick={() => saveCampaign("scheduled")}
                    disabled={loading || smsEligibleCount === 0}
                    variant="secondary"
                  >
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    Schedule Send
                  </Button>
                )}
                <Button
                  onClick={() => saveCampaign("sending")}
                  disabled={loading || smsEligibleCount === 0}
                  className="bg-primary hover:bg-primary/90"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Send Now
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Generation Dialog */}
      <Dialog open={showAiDialog} onOpenChange={setShowAiDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate SMS Content with AI</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="aiPrompt">What should this SMS be about?</Label>
              <Textarea
                id="aiPrompt"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="e.g., Spring sale on garden tools, new plant arrivals, care tips for summer..."
                className="mt-1"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowAiDialog(false)}>
                Cancel
              </Button>
              <Button onClick={generateAIContent} disabled={generating}>
                {generating ? "Generating..." : "Generate Content"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* SMS Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>SMS Preview</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted p-4 rounded-lg">
              <div className="bg-primary text-primary-foreground p-3 rounded-lg max-w-[250px] ml-auto">
                <p className="text-sm whitespace-pre-wrap">
                  {message || "Your message will appear here..."}
                  {message && !message.includes("Reply STOP") && "\n\nReply STOP to unsubscribe."}
                </p>
              </div>
            </div>
            {imageUrl && (
              <div className="text-center">
                <img
                  src={imageUrl}
                  alt="MMS Preview"
                  className="max-w-full h-32 object-cover rounded"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}