
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertCircle } from "lucide-react";
import { generateCampaignContent } from "@/components/homepage/ContentGenerationServices";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { showToast } from "@/utils/toastUtils";

interface ManualContentGeneratorProps {
  campaign: any;
  onContentGenerated: () => void;
}

export const ManualContentGenerator = ({ campaign, onContentGenerated }: ManualContentGeneratorProps) => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateContent = async () => {
    if (!user || !campaign) {
      toast.error("Missing user or campaign information");
      return;
    }

    setIsGenerating(true);
    setError(null);

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
        toast.success(`Successfully generated ${result.tasks?.length || 0} content pieces!`);
        onContentGenerated();
      } else {
        setError(result.message || 'Content generation failed');
        toast.error(result.message || 'Content generation failed');
      }
    } catch (error) {
      console.error('❌ Manual content generation failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(errorMessage);
      toast.error(`Content generation failed: ${errorMessage}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
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
      
      {isGenerating && (
        <div className="text-sm text-gray-600 text-center">
          <p>This may take 30-60 seconds. Please wait...</p>
          <p className="text-xs mt-1">Generating 5 content pieces for review</p>
        </div>
      )}
    </div>
  );
};
