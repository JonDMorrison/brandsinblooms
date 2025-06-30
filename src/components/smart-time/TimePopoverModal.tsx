
import React, { useState } from 'react';
import { format } from 'date-fns';

interface TimePopoverModalProps {
  targetDate: Date | null;
  draftId: string | null;
  onTimeSelection: (timeOption: 'now' | 'best' | 'custom', customTime?: string) => Promise<void>;
  isScheduling: boolean;
}

export const TimePopoverModal = ({ 
  targetDate, 
  draftId, 
  onTimeSelection, 
  isScheduling 
}: TimePopoverModalProps) => {
  const [isOpen, setIsOpen] = useState(true);

  if (!isOpen || !targetDate || !draftId) return null;

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleTimeSelect = async (timeOption: 'now' | 'best' | 'custom', customTime?: string) => {
    await onTimeSelection(timeOption, customTime);
    setIsOpen(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold mb-4">Choose Posting Time</h3>
        <p className="text-gray-600 mb-6">
          When would you like to post this content on {format(targetDate, 'MMMM d, yyyy')}?
        </p>
        
        <div className="space-y-3">
          <button
            onClick={() => handleTimeSelect('best')}
            disabled={isScheduling}
            className="w-full p-3 text-left border rounded-lg hover:bg-[#68BEB9]/10 hover:border-[#68BEB9] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="font-medium">Best Time</div>
            <div className="text-sm text-gray-500">AI-optimized posting time for maximum engagement</div>
          </button>
          
          <button
            onClick={() => handleTimeSelect('now')}
            disabled={isScheduling}
            className="w-full p-3 text-left border rounded-lg hover:bg-[#68BEB9]/10 hover:border-[#68BEB9] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="font-medium">Post Now</div>
            <div className="text-sm text-gray-500">Schedule for immediate posting</div>
          </button>
          
          <div className="border rounded-lg p-3">
            <div className="font-medium mb-2">Custom Time</div>
            <div className="flex gap-2">
              <input
                type="time"
                disabled={isScheduling}
                className="border rounded px-2 py-1 disabled:opacity-50"
                onChange={(e) => {
                  if (e.target.value && !isScheduling) {
                    handleTimeSelect('custom', e.target.value);
                  }
                }}
              />
              <span className="text-sm text-gray-500 self-center">Choose specific time</span>
            </div>
          </div>
        </div>
        
        <div className="flex gap-2 mt-6">
          <button
            onClick={handleClose}
            disabled={isScheduling}
            className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
        </div>
        
        {isScheduling && (
          <div className="flex items-center justify-center mt-4">
            <div className="flex items-center gap-2 text-[#68BEB9]">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#68BEB9]"></div>
              <span className="text-sm">Scheduling...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
