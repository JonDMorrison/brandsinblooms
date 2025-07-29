import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { Mail, ExternalLink, Edit } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCRMAccess } from '@/hooks/useCRMAccess';
import { generateCampaignSlug } from '@/utils/campaignSlugUtils';
import { supabase } from '@/integrations/supabase/client';

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
  const [linkedCampaignId, setLinkedCampaignId] = useState<string | null>(null);
  const [checkingLink, setCheckingLink] = useState(false);

  const canCreateCampaign = task.ai_output && task.status === 'approved' && task.post_type === 'newsletter';
  const isAlreadyLinked = !!linkedCampaignId;

  // Check if content is already linked to a CRM campaign
  useEffect(() => {
    const checkCRMLink = async () => {
      if (!task.id || !canCreateCampaign) return;
      
      setCheckingLink(true);
      try {
        const { data, error } = await supabase
          .from('content_tasks')
          .select('linked_crm_campaign_id')
          .eq('id', task.id)
          .single();

        if (error) throw error;
        setLinkedCampaignId(data?.linked_crm_campaign_id || null);
      } catch (error) {
        console.error('Error checking CRM link:', error);
      } finally {
        setCheckingLink(false);
      }
    };

    checkCRMLink();
  }, [task.id, canCreateCampaign]);

  const handleCreateOrOpenCampaign = async () => {
    if (!canCreateCampaign) return;

    try {
      if (isAlreadyLinked && linkedCampaignId) {
        // Open existing CRM campaign in builder
        navigate(`/crm/campaigns/builder/${linkedCampaignId}`);
        toast({
          title: "Opening CRM Campaign",
          description: "Continuing where you left off..."
        });
      } else {
        // Create new CRM campaign and establish link
        const content = task.ai_output?.replace(/<[^>]*>/g, '').trim() || '';
        const campaignTitle = `Newsletter Campaign - ${new Date().toLocaleDateString()}`;
        
        // Generate unique campaign slug for newsletter
        const campaignSlug = generateCampaignSlug(campaignTitle, task.id);
        
        // Navigate to unique CRM campaign creation with pre-filled data
        const params = new URLSearchParams({
          contentTaskId: task.id,
          title: campaignTitle,
          content: content,
          type: 'newsletter'
        });
        
        navigate(`/crm/campaigns/new/${campaignSlug}?${params.toString()}`);
        toast({
          title: "Creating CRM Campaign",
          description: "Setting up your newsletter campaign..."
        });
      }
    } catch (error) {
      console.error('Error handling CRM campaign:', error);
      toast({
        title: "Error",
        description: "Failed to open CRM campaign. Please try again.",
        variant: "destructive"
      });
    }
  };

  const getTooltipMessage = () => {
    if (loading || checkingLink) return 'Checking CRM access...';
    if (!hasCRMAccess) return 'CRM features are not available on your current plan';
    if (!task.ai_output) return 'Content must be generated first before creating a CRM campaign';
    if (task.status !== 'approved') return 'Content must be approved before creating a CRM campaign';
    if (task.post_type !== 'newsletter') return 'CRM campaigns are only available for newsletter content';
    if (isAlreadyLinked) return 'Continue editing this newsletter in the CRM';
    return 'Create an email campaign in CRM using this newsletter content';
  };

  const getButtonText = () => {
    if (isAlreadyLinked) return 'Open in CRM';
    return 'Send to CRM';
  };

  const getButtonIcon = () => {
    if (isAlreadyLinked) return Edit;
    return Mail;
  };

  const ButtonIcon = getButtonIcon();

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
              <ButtonIcon className="w-4 h-4 mr-2" />
              {getButtonText()}
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
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={handleCreateOrOpenCampaign}
            disabled={checkingLink}
            variant={variant}
            size={size}
            className={`${className} ${isAlreadyLinked 
              ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600' 
              : 'bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600'
            } text-white`}
          >
            <ButtonIcon className="w-4 h-4 mr-2" />
            {checkingLink ? 'Checking...' : getButtonText()}
            <ExternalLink className="w-3 h-3 ml-1" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{getTooltipMessage()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
