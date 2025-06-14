
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Sparkles, Loader2, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface BackfillCampaignsProps {
  currentCampaignCount: number;
  onBackfillComplete: () => void;
}

export const BackfillCampaigns = ({ currentCampaignCount, onBackfillComplete }: BackfillCampaignsProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);

  const handleBackfillCampaigns = async () => {
    if (!user) {
      toast.error('Please log in to generate campaigns');
      return;
    }

    setLoading(true);
    
    try {
      console.log('🚀 Backfilling missing campaigns for existing user...');
      
      const { data, error } = await supabase.functions.invoke('generate-weekly-themes', {
        body: { 
          userId: user.id,
          generateAll52Weeks: true,
          startYear: new Date().getFullYear()
        }
      });

      if (error) {
        console.error('Error generating 52-week backfill:', error);
        throw new Error(error.message || 'Failed to generate campaigns');
      }

      if (data?.themes && Array.isArray(data.themes)) {
        // Save all themes as campaigns
        const campaigns = data.themes.map((theme: any, index: number) => {
          const startDate = new Date();
          startDate.setDate(startDate.getDate() + (index * 7));
          
          return {
            week_number: theme.week,
            title: theme.title,
            theme: theme.title,
            description: theme.description,
            start_date: startDate.toISOString().split('T')[0],
            prompt: theme.content_ideas.join(' • '),
            user_id: user.id,
            source: 'backfill_52_weeks'
          };
        });

        const { error: saveError } = await supabase
          .from('campaigns')
          .insert(campaigns);

        if (saveError) {
          throw new Error(saveError.message);
        }

        console.log(`✅ Successfully backfilled ${data.themes.length} campaigns`);
        setCompleted(true);
        toast.success(`🎉 Generated complete 52-week garden center marketing calendar!`);
        
        // Call the completion callback after a short delay
        setTimeout(() => {
          onBackfillComplete();
        }, 2000);
      } else {
        throw new Error('Invalid response format from theme generator');
      }
    } catch (error: any) {
      console.error('Error backfilling campaigns:', error);
      toast.error(error.message || 'Failed to generate campaigns');
    } finally {
      setLoading(false);
    }
  };

  const missingCampaigns = 52 - currentCampaignCount;

  if (completed) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-green-600" />
            <div>
              <h3 className="font-semibold text-green-900">Backfill Complete!</h3>
              <p className="text-sm text-green-700">Your full 52-week marketing calendar is now ready.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-orange-200 bg-orange-50">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="w-6 h-6 text-orange-600" />
            <div>
              <CardTitle className="text-lg text-orange-900">Complete Your Marketing Calendar</CardTitle>
              <p className="text-sm text-orange-700 mt-1">
                Generate your missing {missingCampaigns} weekly campaigns to have a full year planned
              </p>
            </div>
          </div>
          <Badge className="bg-orange-100 text-orange-800 border-orange-300">
            {currentCampaignCount}/52 campaigns
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center gap-4">
          <Button 
            onClick={handleBackfillCampaigns}
            disabled={loading}
            className="bg-orange-600 hover:bg-orange-700 text-white"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating {missingCampaigns} campaigns...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Full Year ({missingCampaigns} campaigns)
              </>
            )}
          </Button>
          <div className="text-sm text-orange-600">
            This will create seasonal garden center themes for the entire year
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
