
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getCurrentWeekNumber } from "@/utils/dateUtils";
import { AlertTriangle, Loader2, CheckCircle } from "lucide-react";
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
  const [selectedWeek, setSelectedWeek] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [generatingContent, setGeneratingContent] = useState(false);
  const [contentGenerated, setContentGenerated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentWeekNumber = getCurrentWeekNumber();

  // Generate week options (current week + next 12 weeks)
  const generateWeekOptions = () => {
    const options = [];
    for (let i = 0; i < 13; i++) {
      const weekNumber = ((currentWeekNumber + i - 1) % 52) + 1;
      const isCurrentWeek = i === 0;
      options.push({
        value: weekNumber.toString(),
        label: `Week ${weekNumber}${isCurrentWeek ? ' (Current Week)' : ''}`
      });
    }
    return options;
  };

  const calculateStartDate = (weekNumber: number) => {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    
    // Calculate the start of the year
    const startOfYear = new Date(currentYear, 0, 1);
    
    // Calculate the start date for the selected week
    const daysToAdd = (weekNumber - 1) * 7;
    const weekStartDate = new Date(startOfYear.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    
    return weekStartDate.toISOString().split('T')[0];
  };

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

    if (!selectedWeek) {
      setError("Please select a week for the campaign");
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      console.log('NewCampaignDialog: Creating campaign with title:', title.trim(), 'for week:', selectedWeek);
      
      const campaignPrompt = `Create a marketing campaign for "${title}" ${theme ? `with theme: ${theme}` : ''} ${description ? `- ${description}` : ''}. Generate engaging content that promotes this campaign effectively.`;
      
      const weekNumber = parseInt(selectedWeek);
      const startDate = calculateStartDate(weekNumber);
      
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
      
      // Now automatically generate content for the campaign
      setGeneratingContent(true);
      toast.loading('Generating content for your campaign...', { id: 'content-generation' });

      try {
        console.log('NewCampaignDialog: Starting content generation');
        
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
      setSelectedWeek("");
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
      setSelectedWeek("");
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
            <Label htmlFor="week" className="text-garden-green-dark">
              Schedule for Week *
            </Label>
            <Select value={selectedWeek} onValueChange={setSelectedWeek} disabled={loading || generatingContent}>
              <SelectTrigger className="border-garden-green-light focus:border-garden-green">
                <SelectValue placeholder="Select a week for the campaign" />
              </SelectTrigger>
              <SelectContent>
                {generateWeekOptions().map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            />
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
              disabled={!title.trim() || !selectedWeek || loading || generatingContent}
              className="bg-garden-green hover:bg-garden-green-dark text-white !important opacity-100 !important visibility-visible !important display-inline-flex !important"
              style={{
                backgroundColor: '#22C55E !important',
                color: 'white !important',
                opacity: 1,
                visibility: 'visible',
                display: 'inline-flex'
              }}
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
