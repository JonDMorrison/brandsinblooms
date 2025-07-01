import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDashboardContext } from '@/contexts/DashboardContext';

export const TodayFocusCard = () => {
  const { currentCampaign, drafts, loading } = useDashboardContext();

  const getCampaignTitle = () => {
    if (!currentCampaign) return 'No Active Campaign';
    return currentCampaign.title || 'Weekly Campaign';
  };

  const getCompletionPercentage = () => {
    if (!currentCampaign || drafts.length === 0) return 0;
    
    // Mock calculation - in real app would be based on campaign's total tasks vs completed
    const totalTasks = 5; // Assuming 5 tasks per campaign
    const completedTasks = Math.max(0, totalTasks - drafts.length);
    return Math.round((completedTasks / totalTasks) * 100);
  };

  const completionPercentage = getCompletionPercentage();

  if (loading) {
    return (
      <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-md p-6 h-[440px] flex items-center justify-center border border-white/20">
        <div className="animate-spin w-8 h-8 border-2 border-[#68BEB9] border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-md p-6 h-[440px] flex flex-col items-center justify-center border border-white/20">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-[#3E5A6B] text-center mb-8">Today's Focus</h2>
        
        {/* Circular Progress Ring */}
        <div className="relative w-32 h-32 mx-auto mb-6">
          <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 128 128">
            {/* Background ring */}
            <circle
              cx="64"
              cy="64"
              r="56"
              stroke="#E2E8F0"
              strokeWidth="8"
              fill="none"
            />
            {/* Progress ring */}
            <circle
              cx="64"
              cy="64"
              r="56"
              stroke="#68BEB9"
              strokeWidth="8"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 56}`}
              strokeDashoffset={`${2 * Math.PI * 56 * (1 - completionPercentage / 100)}`}
              className="transition-all duration-500"
            />
          </svg>
          
          {/* Bee Icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 bg-[#68BEB9] rounded-full flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-white">
                <path
                  d="M12 2C10.3 2 9 3.3 9 5s1.3 3 3 3 3-1.3 3-3-1.3-3-3-3zm0 14c-2.2 0-4-1.8-4-4s1.8-4 4-4 4 1.8 4 4-1.8 4-4 4z"
                  fill="currentColor"
                />
                <path
                  d="M7 9c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"
                  fill="currentColor"
                />
              </svg>
            </div>
          </div>
        </div>
        
        {/* Campaign Title */}
        <h3 className="text-xl font-semibold text-[#3E5A6B] text-center mb-2">{getCampaignTitle()}</h3>
        
        {/* Progress Badge */}
        <div className="text-center mb-6">
          <Badge variant="outline" className="text-[#68BEB9] border-[#68BEB9]">
            {completionPercentage}% Complete
          </Badge>
        </div>
      </div>
      
      {/* Complete Button */}
      <Button 
        className="bg-[#68BEB9] hover:bg-[#5AA8A3] text-white font-medium px-8 py-2 rounded-full"
        disabled={!currentCampaign}
      >
        VIEW CAMPAIGN
      </Button>
    </div>
  );
};
