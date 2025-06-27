
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { 
  Bold, 
  Italic, 
  Link, 
  Type,
  List,
  Minus
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ComposerPanelProps {
  selectedDraft: any;
  socialConnections: any[];
  onTaskUpdate: () => void;
}

export const ComposerPanel = ({ selectedDraft, socialConnections, onTaskUpdate }: ComposerPanelProps) => {
  const [content, setContent] = useState('');
  const [characterCount, setCharacterCount] = useState(0);

  useEffect(() => {
    if (selectedDraft?.ai_output) {
      setContent(selectedDraft.ai_output);
      setCharacterCount(selectedDraft.ai_output.length);
    } else {
      setContent('');
      setCharacterCount(0);
    }
  }, [selectedDraft]);

  const handleContentChange = (value: string) => {
    setContent(value);
    setCharacterCount(value.length);
  };

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
    <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-md p-6 h-[440px] border border-white/20">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-[#3E5A6B]">Composer</h2>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
          <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
          <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 h-[350px]">
        {/* Left 3 columns - Editor */}
        <div className="col-span-3 flex flex-col">
          {/* Toolbar */}
          <div className="flex items-center gap-2 mb-3 p-2 bg-gray-50 rounded-lg">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <Bold className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <Italic className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <Link className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <List className="w-4 h-4" />
            </Button>
            <div className="ml-auto">
              <Minus className="w-4 h-4 text-gray-400" />
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 flex flex-col">
            <Textarea
              placeholder={selectedDraft ? "Edit your content..." : "Select a draft from the tray to start editing"}
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              className="flex-1 resize-none border-0 shadow-none focus:ring-0 text-sm"
              disabled={!selectedDraft}
            />
            
            {/* Character Counter */}
            <div className="flex justify-between items-center mt-2 pt-2 border-t">
              <span className="text-xs text-gray-500">
                {characterCount} characters
              </span>
              {selectedDraft && (
                <Button 
                  size="sm" 
                  className="bg-[#68BEB9] hover:bg-[#5AA8A3] text-white"
                  onClick={onTaskUpdate}
                >
                  Save
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Right column - Pulse KPIs */}
        <div className="col-span-1 bg-gradient-to-b from-[#68BEB9]/10 to-[#68BEB9]/5 rounded-lg p-4">
          <h3 className="text-sm font-medium text-[#3E5A6B] mb-4 text-center">Pulse</h3>
          
          <div className="space-y-6">
            {Object.values(kpiData).map((kpi, index) => (
              <div key={index}>
                {renderKPIRing(kpi)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
