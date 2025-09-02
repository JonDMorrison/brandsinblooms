
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertCircle } from "lucide-react";
import { generateCampaignContent } from "@/components/homepage/ContentGenerationServices";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { toast } from "@/hooks/use-toast";
import { ContentGenerationLoadingModal } from "./ContentGenerationLoadingModal";
import { ContentViewerDialog } from "./ContentViewerDialog";
import { useGenerationJobTracker } from "@/state/useGenerationJobTracker";
import { useNavigate } from "react-router-dom";

interface ManualContentGeneratorProps {
  campaign: any;
  onContentGenerated: () => void;
  showAsModal?: boolean;
}

export const ManualContentGenerator = ({ campaign, onContentGenerated, showAsModal = false }: ManualContentGeneratorProps) => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const navigate = useNavigate();
  const { startGeneration, completeJob, failJob } = useGenerationJobTracker();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLoadingModal, setShowLoadingModal] = useState(false);
  const [showContentModal, setShowContentModal] = useState(false);
  const [generatedTasks, setGeneratedTasks] = useState<any[]>([]);

  const handleGenerateContent = async () => {
    if (!user || !campaign) {
      toast({
        title: "Missing information",
        description: "Missing user or campaign information",
        variant: "destructive"
      });
      return;
    }

    // Start job tracking
    const jobId = startGeneration({
      type: 'campaign',
      title: campaign.title || campaign.theme || 'Campaign Content',
      redirectPath: '/dashboard',
    });

    setIsGenerating(true);
    setError(null);
    
    if (showAsModal) {
      setShowLoadingModal(true);
    } else {
      // Navigate to dashboard immediately to show progress
      navigate('/dashboard');
    }

    try {
      console.log('🚀 Manual content generation triggered for campaign:', campaign.id);
      
      const result = await generateCampaignContent(
        campaign.id,
        campaign.theme || campaign.title,
        campaign.description || '',
        user.id,
        campaign.week_number,
        tenant?.id
      );

      if (result.success) {
        setGeneratedTasks(result.tasks || []);
        completeJob(jobId);
        setShowLoadingModal(false);
        
        if (showAsModal) {
          setShowContentModal(true);
        } else {
          toast({
            title: "Content Generated Successfully!",
            description: `Generated ${result.tasks?.length || 0} content pieces for your campaign`
          });
          onContentGenerated();
        }
      } else {
        setShowLoadingModal(false);
        const errorMsg = result.message || 'Content generation failed';
        setError(errorMsg);
        failJob(jobId, errorMsg);
        toast({
          title: "Generation failed",
          description: errorMsg,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('❌ Manual content generation failed:', error);
      setShowLoadingModal(false);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(errorMessage);
      failJob(jobId, errorMessage);
      toast({
        title: "Generation failed",
        description: `Content generation failed: ${errorMessage}`,
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCloseContentModal = () => {
    setShowContentModal(false);
    setGeneratedTasks([]);
    onContentGenerated();
  };

  return (
    <>
      <div className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}
        
        <Button
          onClick={handleGenerateContent}
          disabled={isGenerating}
          className="w-full"
          variant="outline"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
          {isGenerating ? 'Generating Content...' : 'Generate Content Manually'}
        </Button>
        
        {isGenerating && !showLoadingModal && (
          <div className="text-sm text-gray-600 text-center">
            <p>This may take 30-60 seconds. Please wait...</p>
            <p className="text-xs mt-1">Generating 5 content pieces for review</p>
          </div>
        )}
      </div>

      {/* Loading Modal */}
      <ContentGenerationLoadingModal
        isOpen={showLoadingModal}
        campaignTitle={campaign?.title || campaign?.theme || 'Your Campaign'}
      />

      {/* Content Viewer Modal */}
      {showAsModal && (
        <ContentViewerDialog
          isOpen={showContentModal}
          onClose={handleCloseContentModal}
          campaignTitle={campaign?.title || campaign?.theme || 'Your Campaign'}
          loading={false}
          tasks={generatedTasks}
          onTaskUpdate={handleCloseContentModal}
        />
      )}
    </>
  );
};
