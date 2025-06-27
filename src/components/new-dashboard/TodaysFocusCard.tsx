
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getDynamicIcon } from './iconUtils';

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

  // Get dynamic icon based on campaign content
  const { icon: DynamicIcon, color: iconColor } = getDynamicIcon(campaign);

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
        
        {/* Dynamic Topic Icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div 
            className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110"
            style={{ backgroundColor: iconColor }}
          >
            <DynamicIcon className="w-5 h-5 text-white" />
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
