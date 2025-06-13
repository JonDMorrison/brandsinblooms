
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, CheckCircle, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface FirstTimeUserWelcomeProps {
  onGetStarted: () => void;
  tasksCount: number;
}

export const FirstTimeUserWelcome = ({ onGetStarted, tasksCount }: FirstTimeUserWelcomeProps) => {
  const { user } = useAuth();
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [companyName, setCompanyName] = useState("");

  useEffect(() => {
    const checkFirstTimeUser = async () => {
      if (!user) return;

      try {
        const { data: profile, error } = await supabase
          .from('company_profiles')
          .select('first_content_generated, company_name, onboarding_completed_at')
          .eq('user_id', user.id)
          .single();

        if (error) {
          console.error('Error checking first time user status:', error);
          return;
        }

        if (profile) {
          setCompanyName(profile.company_name || "Your Garden Center");
          
          // Check if this is their first time seeing generated content
          const isNewUser = profile.onboarding_completed_at && 
                           new Date(profile.onboarding_completed_at) > new Date(Date.now() - 10 * 60 * 1000); // Within last 10 minutes
          
          setIsFirstTime(!!isNewUser && profile.first_content_generated && tasksCount >= 5);
        }
      } catch (error) {
        console.error('Error checking first time user status:', error);
      }
    };

    checkFirstTimeUser();
  }, [user, tasksCount]);

  const handleDismiss = async () => {
    setIsFirstTime(false);
    // Mark that they've seen the welcome
    if (user) {
      const { error } = await supabase
        .from('company_profiles')
        .update({ first_welcome_dismissed: true })
        .eq('user_id', user.id);
        
      if (error) {
        console.error('Error updating welcome dismissed status:', error);
      }
    }
  };

  if (!isFirstTime) return null;

  return (
    <Card className="mb-6 bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 shadow-lg">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-full">
            <Sparkles className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold text-green-800 flex items-center gap-2">
              🎉 Welcome to BloomSuite, {companyName}!
            </CardTitle>
            <p className="text-green-700 mt-1">Your AI marketing assistant has been busy...</p>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="bg-white rounded-lg p-4 border border-green-200">
          <div className="flex items-center gap-3 mb-3">
            <CheckCircle className="w-6 h-6 text-green-600" />
            <h3 className="font-semibold text-gray-800">Your First Week's Content is Ready!</h3>
          </div>
          
          <p className="text-gray-600 mb-4">
            We've analyzed your garden center and automatically created {tasksCount} pieces of marketing content 
            for this week, perfectly tailored to your business and the current gardening season.
          </p>
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
            {['Newsletter', 'Instagram', 'Facebook', 'Email', 'Video'].map((type) => (
              <div key={type} className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-gray-700">{type}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button 
            onClick={onGetStarted}
            className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
          >
            Review Your Content
            <ArrowRight className="w-4 h-4" />
          </Button>
          
          <Button 
            onClick={handleDismiss}
            variant="outline"
            className="border-green-300 text-green-700 hover:bg-green-50"
          >
            I'll Check Later
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
