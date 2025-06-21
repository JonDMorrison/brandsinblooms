
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Calendar } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { getCurrentWeekNumber } from "@/utils/dateUtils";
import { supabase } from "@/integrations/supabase/client";
import { generateCampaignContent } from "@/components/homepage/ContentGenerationServices";
import { toast } from "sonner";
import { useState } from "react";

interface NoCampaignStateCardProps {
  onCreateCampaign: () => void;
}

export const NoCampaignStateCard = ({ onCreateCampaign }: NoCampaignStateCardProps) => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const [creating, setCreating] = useState(false);
  const currentWeekNumber = getCurrentWeekNumber();

  const handleCreateWeeklyCampaign = async () => {
    if (!user) {
      toast.error("Please log in to create a campaign");
      return;
    }

    setCreating(true);
    try {
      toast.loading('Creating your weekly campaign...', { id: 'create-campaign' });

      // Generate theme using the edge function
      const { data: themeData, error: themeError } = await supabase.functions.invoke('generate-weekly-themes', {
        body: { 
          userId: user.id, 
          weekNumber: currentWeekNumber 
        }
      });

      if (themeError) {
        console.error('Error generating theme:', themeError);
        toast.error('Failed to generate campaign theme', { id: 'create-campaign' });
        return;
      }

      const theme = themeData?.themes?.[0];
      if (!theme) {
        toast.error('No theme generated', { id: 'create-campaign' });
        return;
      }

      // Create campaign
      const campaignData: any = {
        week_number: currentWeekNumber,
        title: theme.title,
        description: theme.description,
        theme: theme.title,
        prompt: theme.description,
        start_date: new Date().toISOString().split('T')[0],
        source: 'user_created'
      };

      if (tenant?.id) {
        campaignData.tenant_id = tenant.id;
        campaignData.created_by_user_id = user.id;
      } else {
        campaignData.user_id = user.id;
      }

      const { data: newCampaign, error: campaignError } = await supabase
        .from('campaigns')
        .insert(campaignData)
        .select()
        .single();

      if (campaignError) {
        console.error('Error creating campaign:', campaignError);
        toast.error('Failed to create campaign', { id: 'create-campaign' });
        return;
      }

      toast.success('Campaign created! Now generating content...', { id: 'create-campaign' });

      // Generate content for the campaign
      const result = await generateCampaignContent(
        newCampaign.id,
        newCampaign.theme || newCampaign.title,
        newCampaign.description || '',
        user.id,
        newCampaign.week_number,
        tenant?.id
      );

      if (result.success) {
        toast.success('Campaign created with content successfully!', { id: 'create-campaign' });
        window.location.reload(); // Refresh to show new campaign
      } else {
        toast.warning('Campaign created, but content generation had issues', { id: 'create-campaign' });
      }

    } catch (error) {
      console.error('Error creating weekly campaign:', error);
      toast.error('Failed to create campaign', { id: 'create-campaign' });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Your Weekly Content
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center py-8 space-y-4">
          <div className="text-gray-600 mb-6">
            <p className="mb-2">No active campaign found for this week.</p>
            <p className="text-sm text-gray-500">
              Create a weekly campaign to start generating marketing content.
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              onClick={handleCreateWeeklyCampaign}
              disabled={creating}
              className="bg-garden-green hover:bg-garden-green-dark text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              {creating ? 'Creating...' : 'Create This Week\'s Campaign'}
            </Button>
            
            <Button
              onClick={onCreateCampaign}
              variant="outline"
              className="border-garden-green-light text-garden-green-dark"
            >
              <Plus className="w-4 h-4 mr-2" />
              Custom Campaign
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
