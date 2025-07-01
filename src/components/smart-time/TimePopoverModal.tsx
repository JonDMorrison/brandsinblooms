
import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { X } from 'lucide-react';

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
  const [customTime, setCustomTime] = useState('');

  // Close modal on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isScheduling) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, isScheduling]);

  if (!isOpen || !targetDate || !draftId) return null;

  const handleClose = () => {
    console.log('🎯 TimePopoverModal: Closing modal');
    setIsOpen(false);
  };

  const handleTimeSelect = async (timeOption: 'now' | 'best' | 'custom', customTime?: string) => {
    console.log('🎯 TimePopoverModal: Time selected:', { timeOption, customTime });
    try {
      await onTimeSelection(timeOption, customTime);
      setIsOpen(false);
    } catch (error) {
      console.error('🎯 TimePopoverModal: Error during time selection:', error);
      // Don't close modal on error to allow retry
    }
  };

  const handleCustomTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomTime(e.target.value);
  };

  const handleCustomTimeSubmit = () => {
    if (customTime && !isScheduling) {
      handleTimeSelect('custom', customTime);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Choose Posting Time</h3>
          <button
            onClick={handleClose}
            disabled={isScheduling}
            className="p-1 hover:bg-gray-100 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <p className="text-gray-600 mb-6">
          When would you like to post this content on {format(targetDate, 'MMMM d, yyyy')}?
        </p>
        
        <div className="space-y-3">
          <button
            onClick={() => handleTimeSelect('best')}
            disabled={isScheduling}
            className="w-full p-3 text-left border rounded-lg hover:bg-[#68BEB9]/10 hover:border-[#68BEB9] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <div className="font-medium">Best Time</div>
            <div className="text-sm text-gray-500">AI-optimized posting time for maximum engagement</div>
          </button>
          
          <button
            onClick={() => handleTimeSelect('now')}
            disabled={isScheduling}
            className="w-full p-3 text-left border rounded-lg hover:bg-[#68BEB9]/10 hover:border-[#68BEB9] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <div className="font-medium">Post Now</div>
            <div className="text-sm text-gray-500">Schedule for immediate posting</div>
          </button>
          
          <div className="border rounded-lg p-3">
            <div className="font-medium mb-2">Custom Time</div>
            <div className="flex gap-2">
              <input
                type="time"
                value={customTime}
                onChange={handleCustomTimeChange}
                disabled={isScheduling}
                className="border rounded px-2 py-1 disabled:opacity-50 flex-1"
              />
              <button
                onClick={handleCustomTimeSubmit}
                disabled={isScheduling || !customTime}
                className="px-3 py-1 bg-[#68BEB9] text-white rounded hover:bg-[#56a7a1] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Set
              </button>
            </div>
          </div>
        </div>
        
        <div className="flex gap-2 mt-6">
          <button
            onClick={handleClose}
            disabled={isScheduling}
            className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
