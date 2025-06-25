
import React from 'react';
import { Button } from '@/components/ui/button';
import { CheckSquare, Square } from 'lucide-react';

interface BatchModeToggleProps {
  batchMode: boolean;
  onToggle: (enabled: boolean) => void;
  selectedCount: number;
}

export const BatchModeToggle: React.FC<BatchModeToggleProps> = ({
  batchMode,
  onToggle,
  selectedCount
}) => {
  return (
    <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 rounded-lg">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onToggle(!batchMode)}
          className="text-gray-600 hover:text-gray-800"
        >
          {batchMode ? (
            <CheckSquare className="w-4 h-4 mr-2" />
          ) : (
            <Square className="w-4 h-4 mr-2" />
          )}
          Select multiple
        </Button>
        
        {batchMode && selectedCount > 0 && (
          <span className="text-sm text-gray-600">
            {selectedCount} selected
          </span>
        )}
      </div>
      
      {batchMode && selectedCount > 0 && (
        <div className="flex gap-2">
          <Button size="sm" variant="outline">
            Post Selected to Facebook
          </Button>
          <Button size="sm" variant="outline">
            Post Selected to Instagram
          </Button>
        </div>
      )}
    </div>
  );
};
