
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface TodaysFocusCardProps {
  campaign: any;
  onComplete: () => void;
}

export const TodaysFocusCard = ({ campaign, onComplete }: TodaysFocusCardProps) => {
  const getCampaignTitle = () => {
    if (!campaign) return 'No Active Campaign';
    return campaign.title || 'Weekly Campaign';
  };

  const getCompletionPercentage = () => {
    // Mock calculation - in real app would be based on campaign's tasks
    return campaign ? 75 : 0;
  };

  const completionPercentage = getCompletionPercentage();

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-md p-4 h-full flex flex-col items-center justify-center border border-white/20">
      <h2 className="text-lg font-semibold text-[#3E5A6B] text-center mb-4">Today's Focus</h2>
      
      {/* Circular Progress Ring - Smaller size */}
      <div className="relative w-24 h-24 mx-auto mb-4">
        <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 96 96">
          {/* Background ring */}
          <circle
            cx="48"
            cy="48"
            r="42"
            stroke="#E2E8F0"
            strokeWidth="6"
            fill="none"
          />
          {/* Progress ring */}
          <circle
            cx="48"
            cy="48"
            r="42"
            stroke="#68BEB9"
            strokeWidth="6"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 42}`}
            strokeDashoffset={`${2 * Math.PI * 42 * (1 - completionPercentage / 100)}`}
            className="transition-all duration-500"
          />
        </svg>
        
        {/* Bee Icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-10 h-10 bg-[#68BEB9] rounded-full flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-white">
              <path
                d="M12 2C10.3 2 9 3.3 9 5s1.3 3 3 3 3-1.3 3-3-1.3-3-3-3zm0 14c-2.2 0-4-1.8-4-4s1.8-4 4-4 4 1.8 4 4-1.8 4-4 4z"
                fill="currentColor"
              />
              <path
                d="M7 9c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm10 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"
                fill="currentColor"
              />
            </svg>
          </div>
        </div>
      </div>
      
      {/* Campaign Title */}
      <h3 className="text-lg font-semibold text-[#3E5A6B] text-center mb-2">{getCampaignTitle()}</h3>
      
      {/* Progress Badge */}
      <div className="text-center mb-4">
        <Badge variant="outline" className="text-[#68BEB9] border-[#68BEB9]">
          {completionPercentage}% Complete
        </Badge>
      </div>
      
      {/* Complete Button */}
      <Button 
        className="bg-[#68BEB9] hover:bg-[#5AA8A3] text-white font-medium px-6 py-2 rounded-full"
        disabled={!campaign}
        size="sm"
      >
        VIEW CAMPAIGN
      </Button>
    </div>
  );
};
