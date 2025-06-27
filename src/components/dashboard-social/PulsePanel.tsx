
import React from 'react';

export const PulsePanel = () => {
  // Mock KPI data - in real app would come from analytics
  const kpiData = {
    reach: { current: 75, goal: 100, label: 'Reach' },
    engagement: { current: 85, goal: 100, label: 'Engagement' },
    growth: { current: 65, goal: 100, label: 'Growth' }
  };

  const renderKPIRing = (kpi: typeof kpiData.reach) => {
    const percentage = (kpi.current / kpi.goal) * 100;
    const isGoalMet = percentage >= 100;
    
    return (
      <div className="flex flex-col items-center">
        <div className="relative w-16 h-16 mb-2">
          <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 64 64">
            <circle
              cx="32"
              cy="32"
              r="28"
              stroke="#E2E8F0"
              strokeWidth="4"
              fill="none"
            />
            <circle
              cx="32"
              cy="32"
              r="28"
              stroke={isGoalMet ? "#22C55E" : "#68BEB9"}
              strokeWidth="4"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 28}`}
              strokeDashoffset={`${2 * Math.PI * 28 * (1 - percentage / 100)}`}
              className="transition-all duration-300"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-medium text-[#3E5A6B]">{kpi.current}</span>
          </div>
        </div>
        <span className="text-xs text-gray-600">{kpi.label}</span>
      </div>
    );
  };

  return (
    <div className="bg-gradient-to-b from-[#68BEB9]/10 to-[#68BEB9]/5 rounded-lg p-4 h-full">
      <h3 className="text-sm font-medium text-[#3E5A6B] mb-4 text-center">Pulse</h3>
      
      <div className="space-y-6">
        {Object.values(kpiData).map((kpi, index) => (
          <div key={index}>
            {renderKPIRing(kpi)}
          </div>
        ))}
      </div>
    </div>
  );
};
