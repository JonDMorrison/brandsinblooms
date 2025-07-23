import React from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { Mail, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCRMAccess } from '@/hooks/useCRMAccess';

interface PostToCRMButtonProps {
  task: any;
  className?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'default' | 'lg';
}

export const PostToCRMButton: React.FC<PostToCRMButtonProps> = ({
  task,
  className = '',
  variant = 'default',
  size = 'default'
}) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hasCRMAccess, loading } = useCRMAccess();

  const canCreateCampaign = task.ai_output && task.status === 'approved' && task.post_type === 'newsletter';

  const handleCreateCampaign = () => {
    if (!canCreateCampaign) return;

    // Extract newsletter content for pre-filling
    const content = task.ai_output?.replace(/<[^>]*>/g, '').trim() || '';
    const campaignTitle = `Newsletter Campaign - ${new Date().toLocaleDateString()}`;
    
    // Navigate to CRM campaign creation with pre-filled data
    const params = new URLSearchParams({
      contentTaskId: task.id,
      title: campaignTitle,
      content: content.substring(0, 500), // Limit content preview
      type: 'newsletter'
    });
    
    navigate(`/crm/campaigns/new?${params.toString()}`);
    toast({
      title: "Success",
      description: "Redirecting to CRM campaign creation..."
    });
  };

  const getTooltipMessage = () => {
    if (loading) return 'Checking CRM access...';
    if (!hasCRMAccess) return 'CRM features are not available on your current plan';
    if (!task.ai_output) return 'Content must be generated first before creating a CRM campaign';
    if (task.status !== 'approved') return 'Content must be approved before creating a CRM campaign';
    if (task.post_type !== 'newsletter') return 'CRM campaigns are only available for newsletter content';
    return 'Create an email campaign in CRM using this newsletter content';
  };

  if (!canCreateCampaign || !hasCRMAccess) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              disabled
              variant={variant}
              size={size}
              className={`${className} opacity-50`}
            >
              <Mail className="w-4 h-4 mr-2" />
              Create CRM Campaign
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{getTooltipMessage()}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Button
      onClick={handleCreateCampaign}
      variant={variant}
      size={size}
      className={`${className} bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white`}
    >
      <Mail className="w-4 h-4 mr-2" />
      Create CRM Campaign
      <ExternalLink className="w-3 h-3 ml-1" />
    </Button>
  );
};
