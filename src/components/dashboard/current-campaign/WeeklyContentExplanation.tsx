
import React from "react";
import { Button } from "@/components/ui/button";
import { Info, RefreshCw } from "lucide-react";

interface WeeklyContentExplanationProps {
  onRefreshContent?: () => void;
  isRefreshing?: boolean;
}

export const WeeklyContentExplanation = ({ 
  onRefreshContent, 
  isRefreshing = false 
}: WeeklyContentExplanationProps) => {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <h4 className="font-medium text-blue-900 mb-2">
            Your Weekly Marketing Content
          </h4>
          <p className="text-sm text-blue-800 leading-relaxed mb-3">
            Every week, we automatically generate 5 pieces of professional marketing content 
            tailored to your garden center. This includes social media posts for Instagram 
            and Facebook, a newsletter, a blog post, and a video script - all customized 
            with seasonal themes and gardening expertise.
          </p>
          <div className="flex items-center gap-2">
            <Button
              onClick={onRefreshContent}
              disabled={isRefreshing}
              size="sm"
              variant="outline"
              className="border-blue-300 text-blue-700 hover:bg-blue-100"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing...' : 'Refresh Content'}
            </Button>
            <span className="text-xs text-blue-600">
              Generate new content for this week
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
