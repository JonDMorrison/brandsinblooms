
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertCircle } from "lucide-react";
import { generateCampaignContent } from "@/components/homepage/ContentGenerationServices";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { toast } from "@/hooks/use-toast";
import { ContentGenerationLoadingModal } from "./ContentGenerationLoadingModal";
import { ContentViewerDialog } from "./ContentViewerDialog";

interface ManualContentGeneratorProps {
  campaign: any;
  onContentGenerated: () => void;
  showAsModal?: boolean;
}

export const ManualContentGenerator = ({ campaign, onContentGenerated, showAsModal = false }: ManualContentGeneratorProps) => {
  const { user } = useAuth();
  const { tenant } = useTenant();
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

    setIsGenerating(true);
    setError(null);
    setShowLoadingModal(true);

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
        setShowLoadingModal(false);
        
        if (showAsModal) {
          setShowContentModal(true);
        } else {
          toast({
            title: "Success!",
            description: `Successfully generated ${result.tasks?.length || 0} content pieces!`
          });
          onContentGenerated();
        }
      } else {
        setShowLoadingModal(false);
        setError(result.message || 'Content generation failed');
        toast({
          title: "Generation failed",
          description: result.message || 'Content generation failed',
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('❌ Manual content generation failed:', error);
      setShowLoadingModal(false);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(errorMessage);
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
