
import { useState, useRef } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { dateToWeekNumber } from "@/utils/dateUtils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Loader2, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { generateRequiredTasks } from "./RequiredTasksGenerator";

interface NewCampaignModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCampaignCreated: () => void;
}

export const NewCampaignModal = ({ open, onOpenChange, onCampaignCreated }: NewCampaignModalProps) => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [theme, setTheme] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [loading, setLoading] = useState(false);
  const [generatingContent, setGeneratingContent] = useState(false);
  const [contentGenerated, setContentGenerated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      setError("You must be logged in to create a campaign");
      return;
    }

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
      console.log('🔒 SECURITY: Creating campaign for user:', user.id, 'tenant:', tenant?.id || 'none');

      const campaignPrompt = `Create a marketing campaign for "${title}" ${theme ? `with theme: ${theme}` : ''} ${description ? `- ${description}` : ''}. Generate engaging content that promotes this campaign effectively.`;

      const weekNumber = dateToWeekNumber(selectedDate);
      const startDate = selectedDate.toISOString().split('T')[0];

      // 🔒 SECURITY: Always set user_id, only set tenant_id if tenant exists
      const campaignData = {
        title: title.trim(),
        description: description.trim() || null,
        theme: theme.trim() || null,
        prompt: campaignPrompt,
        start_date: startDate,
        week_number: weekNumber,
        source: 'quick_action',
        user_id: user.id, // 🔒 CRITICAL: Always set user_id for RLS
        created_by_user_id: user.id, // 🔒 Track who created it
        ...(tenant?.id && { tenant_id: tenant.id }) // 🔒 Only set tenant_id if real tenant exists
      };

      console.log('🔒 SECURITY: Creating campaign with proper user isolation:', {
        user_id: campaignData.user_id,
        tenant_id: campaignData.tenant_id || 'none',
        title: campaignData.title
      });

      const { data: insertedCampaign, error: insertError } = await supabase
        .from('campaigns')
        .insert(campaignData)
        .select()
        .single();

      if (insertError) {
        console.error('❌ NewCampaignModal: Error creating campaign:', insertError);
        throw new Error(insertError.message);
      }

      console.log('✅ NewCampaignModal: Campaign created with proper isolation:', insertedCampaign);
      
      // Now automatically generate content for the campaign
      setGeneratingContent(true);
       toast({
         title: "Generating content for your campaign...",
         description: "Please wait while we create your promotional content",
       });

      try {
        console.log('🔒 SECURITY: Starting content generation with proper user isolation');
        
        const result = await generateRequiredTasks(
          insertedCampaign.id,
          [insertedCampaign],
          user.id, // 🔒 CRITICAL: Pass user_id for RLS
          onCampaignCreated,
          tenant?.id // 🔒 Pass tenant_id only if it exists
        );

        if (result.success) {
          console.log('✅ NewCampaignModal: Content generated successfully with user isolation');
          setContentGenerated(true);
          toast({
            title: "Success!",
            description: `Campaign created with ${result.tasks?.length || 5} content pieces!`,
          });
        } else {
          console.warn('⚠️ NewCampaignModal: Content generation had issues:', result.message);
          toast({
            title: "Warning",
            description: `Campaign created, but content generation had issues: ${result.message}`,
            variant: "destructive",
          });
        }
      } catch (contentError) {
        console.error('❌ NewCampaignModal: Content generation failed:', contentError);
        toast({
          title: "Error",
          description: "Campaign created, but content generation failed. You can generate content manually.",
          variant: "destructive",
        });
      }

      // Reset form
      setTitle("");
      setDescription("");
      setTheme("");
      setSelectedDate(undefined);
      setError(null);

      // Close modal after short delay to show success state
      setTimeout(() => {
        onOpenChange(false);
        setContentGenerated(false);
        setGeneratingContent(false);
      }, 2000);
      
    } catch (error: any) {
      console.error('❌ NewCampaignModal: Error creating campaign:', error);
      setError(error.message || 'Failed to create campaign');
      toast({
        title: "Error",
        description: error.message || 'Failed to create campaign',
        variant: "destructive",
      });
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
      <DialogContent ref={modalRef} className="sm:max-w-[425px] bg-white">
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
              Campaign Start Date *
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
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
                  disabled={(date) =>
                    date < new Date() || date < new Date("1900-01-01")
                  }
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
          
          <div>
            <Label htmlFor="theme" className="text-garden-green-dark">
              Campaign Theme
            </Label>
            <Input
              id="theme"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              placeholder="Campaign theme (e.g., Spring Sale, Product Launch)"
              className="border-garden-green-light focus:border-garden-green"
              disabled={loading || generatingContent}
            />
          </div>
          
          <div>
            <Label htmlFor="description" className="text-garden-green-dark">
              Description
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your campaign goals and key messages"
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
              disabled={!title.trim() || !selectedDate || loading || generatingContent}
              className="bg-garden-green hover:bg-garden-green-dark text-white"
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
