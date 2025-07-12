
import { useState } from "react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { dateToWeekNumber } from "@/utils/dateUtils";
import { AlertTriangle, Loader2, CheckCircle, CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { Campaign } from "@/types/content";
import { generateCampaignContent } from "@/components/homepage/ContentGenerationServices";

interface NewCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (campaign: Campaign) => void;
}

export const NewCampaignDialog = ({ open, onOpenChange, onCreate }: NewCampaignDialogProps) => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [theme, setTheme] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [loading, setLoading] = useState(false);
  const [generatingContent, setGeneratingContent] = useState(false);
  const [contentGenerated, setContentGenerated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      setError("You must be logged in to create a campaign");
      return;
    }
    
    // Validation
    if (!title.trim()) {
      setError("Campaign title is required");
      return;
    }

    if (title.trim().length < 3) {
      setError("Campaign title must be at least 3 characters");
      return;
    }

    if (!selectedDate) {
      setError("Please select a start date for the campaign");
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      console.log('NewCampaignDialog: Creating campaign with title:', title.trim(), 'for date:', selectedDate);
      
      const campaignPrompt = `Create a marketing campaign for "${title}" ${theme ? `with theme: ${theme}` : ''} ${description ? `- ${description}` : ''}. Generate engaging content that promotes this campaign effectively.`;
      
      const weekNumber = dateToWeekNumber(selectedDate);
      const startDate = selectedDate.toISOString().split('T')[0];
      
      const newCampaign = {
        title: title.trim(),
        description: description.trim() || null,
        theme: theme.trim() || null,
        prompt: campaignPrompt,
        start_date: startDate,
        week_number: weekNumber,
        source: 'quick_action',
        user_id: user.id,
        ...(tenant?.id && { tenant_id: tenant.id })
      };

      // Create campaign directly in Supabase
      const { data, error: insertError } = await supabase
        .from('campaigns')
        .insert(newCampaign)
        .select()
        .single();

      if (insertError) {
        console.error('NewCampaignDialog: Error creating campaign:', insertError);
        throw new Error(insertError.message);
      }

      console.log('NewCampaignDialog: Campaign created successfully:', data);
      
      // Wait a moment to ensure the campaign is fully committed to the database
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Now automatically generate content for the campaign
      setGeneratingContent(true);
      toast.loading('Generating content for your campaign...', { id: 'content-generation' });

      try {
        console.log('NewCampaignDialog: Starting content generation for campaign ID:', data.id);
        
        // Double-check that the campaign exists before generating content
        const { data: campaignCheck } = await supabase
          .from('campaigns')
          .select('id')
          .eq('id', data.id)
          .single();
        
        if (!campaignCheck) {
          throw new Error('Campaign not found in database after creation');
        }
        
        const result = await generateCampaignContent(
          data.id,
          data.theme || data.title,
          data.description || '',
          user.id,
          data.week_number,
          tenant?.id
        );

        if (result.success) {
          console.log('NewCampaignDialog: Content generated successfully');
          setContentGenerated(true);
          toast.success(`Campaign created with ${result.tasks?.length || 5} content pieces!`, { id: 'content-generation' });
        } else {
          console.warn('NewCampaignDialog: Content generation had issues:', result.message);
          toast.warning(`Campaign created, but content generation had issues: ${result.message}`, { id: 'content-generation' });
        }
      } catch (contentError) {
        console.error('NewCampaignDialog: Content generation failed:', contentError);
        toast.error('Campaign created, but content generation failed. You can generate content manually.', { id: 'content-generation' });
      }

      // Reset form
      setTitle("");
      setDescription("");
      setTheme("");
      setSelectedDate(undefined);
      setError(null);
      
      console.log('NewCampaignDialog: Campaign created successfully');
      toast.success('Campaign created successfully!');
      
      // Close modal after short delay to show success state
      setTimeout(() => {
        onOpenChange(false);
        setContentGenerated(false);
        setGeneratingContent(false);
        onCreate(data);
      }, 2000);
      
    } catch (error: any) {
      console.error('NewCampaignDialog: Error creating campaign:', error);
      setError(error.message || 'Failed to create campaign');
      toast.error(error.message || 'Failed to create campaign');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading && !generatingContent) {
      setTitle("");
      setDescription("");
      setTheme("");
      setSelectedDate(undefined);
      setError(null);
      setContentGenerated(false);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] bg-white">
        <DialogHeader>
          <DialogTitle className="text-garden-green-dark">Create New Campaign</DialogTitle>
        </DialogHeader>
        
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {contentGenerated && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              Campaign created successfully with 5 content pieces! Check your dashboard to review and approve the content.
            </AlertDescription>
          </Alert>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title" className="text-garden-green-dark">
              Campaign Title *
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setError(null);
              }}
              placeholder="Enter campaign title"
              required
              className="border-garden-green-light focus:border-garden-green"
              disabled={loading || generatingContent}
            />
          </div>

          <div>
            <Label htmlFor="date" className="text-garden-green-dark">
              Start Date *
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal border-garden-green-light focus:border-garden-green",
                    !selectedDate && "text-muted-foreground"
                  )}
                  disabled={loading || generatingContent}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP") : <span>Pick a start date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
          
          <div>
            <Label htmlFor="description" className="text-garden-green-dark">
              Description
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your campaign"
              className="border-garden-green-light focus:border-garden-green"
              disabled={loading || generatingContent}
            />
          </div>
          
          <div>
            <Label htmlFor="theme" className="text-garden-green-dark">
              Theme
            </Label>
            <Input
              id="theme"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              placeholder="Campaign theme (e.g., Spring Planting)"
              className="border-garden-green-light focus:border-garden-green"
              disabled={loading || generatingContent}
              aria-describedby="theme-help"
            />
            <p id="theme-help" className="text-sm text-gray-500 mt-1">
              Optional theme to guide content generation
            </p>
          </div>
          
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="border-garden-green-light text-garden-green-dark"
              disabled={loading || generatingContent}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!title.trim() || !selectedDate || loading || generatingContent}
              className="bg-brand-teal-mint hover:bg-brand-teal-mint-600 text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : generatingContent ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating Content...
                </>
              ) : contentGenerated ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Complete!
                </>
              ) : (
                'Create Campaign'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
