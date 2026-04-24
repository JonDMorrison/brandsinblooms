import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui-legacy/dialog";
import { Button } from "@/components/ui-legacy/button";
import { Input } from "@/components/ui-legacy/input";
import { Textarea } from "@/components/ui-legacy/textarea";
import { Label } from "@/components/ui-legacy/label";
import { Alert, AlertDescription } from "@/components/ui-legacy/alert";
import { dateToWeekNumber } from "@/utils/dateUtils";
import { AlertTriangle, Loader2, CheckCircle, Circle } from "lucide-react";
import { toast } from "@/utils/toast";
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

export const NewCampaignDialog = ({
  open,
  onOpenChange,
  onCreate,
}: NewCampaignDialogProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [theme, setTheme] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [generatingContent, setGeneratingContent] = useState(false);
  const [contentGenerated, setContentGenerated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creationStep, setCreationStep] = useState<
    "idle" | "creating" | "generating" | "done"
  >("idle");

  const isInProgress = loading || generatingContent;

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
    setCreationStep("creating");
    setError(null);

    try {
      const campaignPrompt = `Create a marketing campaign for "${title}" ${theme ? `with theme: ${theme}` : ""} ${description ? `- ${description}` : ""}. Generate engaging content that promotes this campaign effectively.`;

      const startDate = selectedDate;
      const weekNumber = dateToWeekNumber(new Date(selectedDate));

      const newCampaign = {
        title: title.trim(),
        description: description.trim() || null,
        theme: theme.trim() || null,
        prompt: campaignPrompt,
        start_date: startDate,
        week_number: weekNumber,
        source: "quick_action",
        user_id: user.id,
        ...(tenant?.id && { tenant_id: tenant.id }),
      };

      // Create campaign directly in Supabase
      const { data, error: insertError } = await supabase
        .from("campaigns")
        .insert(newCampaign)
        .select()
        .single();

      if (insertError) {
        console.error(
          "NewCampaignDialog: Error creating campaign:",
          insertError,
        );
        throw new Error(insertError.message);
      }
      // Immediately notify parent so the campaign list refreshes without delay
      onCreate(data);

      // Reset form
      setTitle("");
      setDescription("");
      setTheme("");
      setSelectedDate("");
      setError(null);

      // Campaign draft created — move to content generation step
      setLoading(false);
      setGeneratingContent(true);
      setCreationStep("generating");

      try {
        const result = await generateCampaignContent(
          data.id,
          data.theme || data.title,
          data.description || "",
          user.id,
          data.week_number,
          tenant?.id,
        );

        if (result.success) {
          setContentGenerated(true);
          setCreationStep("done");
          toast.success(
            `Campaign created with ${result.tasks?.length || 5} content pieces!`,
          );
        } else {
          setContentGenerated(true);
          setCreationStep("done");
          toast.info(
            `Campaign created. Content generation had issues: ${result.message}`,
          );
        }
      } catch (contentError) {
        console.error(
          "NewCampaignDialog: Content generation failed:",
          contentError,
        );
        // Campaign was still created — mark as done and let user continue
        setContentGenerated(true);
        setCreationStep("done");
        toast.error(
          "Campaign created, but content generation failed. You can generate content manually.",
        );
      }

      // Reset form
      setTitle("");
      setDescription("");
      setTheme("");
      setSelectedDate("");
      setError(null);
      // Close modal after short delay to show success state, then navigate
      setTimeout(() => {
        onOpenChange(false);
        setContentGenerated(false);
        setGeneratingContent(false);
        setCreationStep("idle");
        onCreate(data);
        navigate("/campaigns");
      }, 2000);
    } catch (error: any) {
      console.error("NewCampaignDialog: Error creating campaign:", error);
      setError(error.message || "Failed to create campaign");
      setCreationStep("idle");
      toast.error(error.message || "Failed to create campaign");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!isInProgress) {
      setTitle("");
      setDescription("");
      setTheme("");
      setSelectedDate("");
      setError(null);
      setContentGenerated(false);
      setCreationStep("idle");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] bg-white">
        <DialogHeader>
          <DialogTitle className="text-garden-green-dark">
            Create New Campaign
          </DialogTitle>
          <DialogDescription className="text-gray-600">
            Create a new marketing campaign with automated content generation.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {creationStep !== "idle" && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-2">
            <p className="text-sm font-medium text-gray-700 mb-3">
              Campaign creation progress
            </p>
            <div className="flex items-center gap-3">
              {creationStep === "creating" ? (
                <Loader2 className="h-4 w-4 animate-spin text-brand-teal-mint shrink-0" />
              ) : (
                <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
              )}
              <span
                className={`text-sm ${creationStep === "creating" ? "text-gray-900 font-medium" : "text-gray-500"}`}
              >
                Draft created
              </span>
            </div>
            <div className="flex items-center gap-3">
              {creationStep === "generating" ? (
                <Loader2 className="h-4 w-4 animate-spin text-brand-teal-mint shrink-0" />
              ) : creationStep === "done" ? (
                <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
              ) : (
                <Circle className="h-4 w-4 text-gray-300 shrink-0" />
              )}
              <span
                className={`text-sm ${creationStep === "generating" ? "text-gray-900 font-medium" : creationStep === "done" ? "text-gray-500" : "text-gray-400"}`}
              >
                Generating campaign content
              </span>
            </div>
            <div className="flex items-center gap-3">
              {creationStep === "done" ? (
                <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
              ) : (
                <Circle className="h-4 w-4 text-gray-300 shrink-0" />
              )}
              <span
                className={`text-sm ${creationStep === "done" ? "text-green-700 font-medium" : "text-gray-400"}`}
              >
                {creationStep === "done"
                  ? "All done — redirecting you now…"
                  : "Finalizing content"}
              </span>
            </div>
          </div>
        )}

        {contentGenerated && creationStep === "done" && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              Campaign created successfully with content pieces! You'll be
              redirected to your new campaign shortly.
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
              disabled={isInProgress}
            />
          </div>

          <div>
            <Label htmlFor="date" className="text-garden-green-dark">
              Start Date *
            </Label>
            <Input
              id="date"
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setError(null);
              }}
              min={new Date().toISOString().split("T")[0]}
              required
              className="border-garden-green-light focus:border-garden-green"
              disabled={isInProgress}
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
              placeholder="Describe your campaign"
              className="border-garden-green-light focus:border-garden-green"
              disabled={isInProgress}
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
              disabled={isInProgress}
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
              disabled={isInProgress}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!title.trim() || !selectedDate || isInProgress}
              className="bg-brand-teal-mint hover:bg-brand-teal-mint-600 text-white"
            >
              {creationStep === "creating" ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating draft…
                </>
              ) : creationStep === "generating" ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating content…
                </>
              ) : creationStep === "done" ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Done!
                </>
              ) : (
                "Create Campaign"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
