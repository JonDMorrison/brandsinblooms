
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface NewCampaignModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCampaignCreated: () => void;
}

export const NewCampaignModal = ({ open, onOpenChange, onCampaignCreated }: NewCampaignModalProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [campaignName, setCampaignName] = useState("");
  const [eventDate, setEventDate] = useState<Date>();
  const [description, setDescription] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!campaignName.trim() || !eventDate) {
      toast.error("Please fill in the campaign name and date");
      return;
    }

    setLoading(true);

    try {
      // Calculate week number from event date
      const eventYear = eventDate.getFullYear();
      const firstDayOfYear = new Date(eventYear, 0, 1);
      const pastDaysOfYear = (eventDate.getTime() - firstDayOfYear.getTime()) / 86400000;
      const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);

      // Create campaign
      const { data: campaign, error: campaignError } = await supabase
        .from('campaigns')
        .insert({
          title: campaignName.trim(),
          description: description.trim() || null,
          start_date: format(eventDate, 'yyyy-MM-dd'),
          week_number: weekNumber,
          theme: campaignName.trim()
        })
        .select()
        .single();

      if (campaignError) throw campaignError;

      // Generate content for all 5 platforms
      const contentTypes = ['facebook', 'instagram', 'video', 'newsletter', 'email'];
      const contentPromises = contentTypes.map(async (postType) => {
        try {
          // Generate content using OpenAI
          const { data: contentData, error: contentError } = await supabase.functions.invoke('generate-content', {
            body: {
              postType,
              campaignTitle: campaignName,
              userId: user?.id
            }
          });

          if (contentError) {
            console.error(`Error generating ${postType} content:`, contentError);
            return null;
          }

          // Create content task
          const { error: taskError } = await supabase
            .from('content_tasks')
            .insert({
              campaign_id: campaign.id,
              post_type: postType,
              ai_output: contentData.content,
              status: 'draft',
              hashtags: getHashtagsForType(postType),
              image_idea: getImageIdeaForType(postType),
              scheduled_date: format(eventDate, 'yyyy-MM-dd')
            });

          if (taskError) {
            console.error(`Error creating ${postType} task:`, taskError);
            return null;
          }

          return postType;
        } catch (error) {
          console.error(`Error with ${postType}:`, error);
          return null;
        }
      });

      const results = await Promise.all(contentPromises);
      const successfulContent = results.filter(Boolean);

      toast.success(`Campaign created! Generated ${successfulContent.length} pieces of content for review.`);

      // Reset form
      setCampaignName("");
      setDescription("");
      setEventDate(undefined);
      onOpenChange(false);
      onCampaignCreated();

    } catch (error: any) {
      console.error('Error creating campaign:', error);
      toast.error(error.message || "Failed to create campaign");
    } finally {
      setLoading(false);
    }
  };

  const getHashtagsForType = (postType: string) => {
    switch (postType) {
      case 'facebook':
        return '#Campaign #GardenCenter #Community';
      case 'instagram':
        return '#Campaign #GardenLife #Plants #Instagram';
      case 'video':
        return '#CampaignVideo #GardenTips #Tutorial';
      case 'newsletter':
        return '#Newsletter #CampaignAnnouncement #Community';
      case 'email':
        return '#CampaignEmail #Newsletter #Community';
      default:
        return '#Campaign #GardenCenter';
    }
  };

  const getImageIdeaForType = (postType: string) => {
    switch (postType) {
      case 'facebook':
        return 'Campaign announcement image with key details and garden elements';
      case 'instagram':
        return 'Square campaign promo image with vibrant garden imagery';
      case 'video':
        return 'Video thumbnail featuring campaign highlights and garden center branding';
      case 'newsletter':
        return 'Newsletter header with campaign branding and seasonal elements';
      case 'email':
        return 'Email header with campaign details and garden center branding';
      default:
        return 'Campaign promotional image';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Campaign</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="campaignName">Campaign Name *</Label>
            <Input
              id="campaignName"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="e.g., Spring Plant Sale, Summer Garden Workshop"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Event/Campaign Date *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !eventDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {eventDate ? format(eventDate, "PPP") : "When is the campaign/event?"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={eventDate}
                  onSelect={setEventDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Campaign Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the campaign, target audience, key messages, or special promotions..."
              rows={4}
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating Campaign & Generating Content...
                </>
              ) : (
                "Create Campaign & Generate Content"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
