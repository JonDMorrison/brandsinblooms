
import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { useSmartTime } from '@/hooks/useSmartTime';
import { scheduleDraft } from '@/lib/dashboardAPI';

import { Button } from '@/components/ui/button';

interface TimePopoverModalProps {
  task: any | null;
  isOpen: boolean;
  onClose: () => void;
  onScheduled?: () => void;
}

export const TimePopoverModal = ({ 
  task,
  isOpen,
  onClose,
  onScheduled
}: TimePopoverModalProps) => {
  const { getBestSlot } = useSmartTime();
  const [isScheduling, setIsScheduling] = useState(false);
  const [customDate, setCustomDate] = useState('');
  const [customTime, setCustomTime] = useState('');
  const [bestTimes, setBestTimes] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen && task) {
      // Get AI suggestions when modal opens
      getBestSlot(task.post_type || 'facebook').then(({ bestDateTime, alternatives }) => {
        const times = [bestDateTime, ...alternatives].map(dt => 
          format(new Date(dt), 'h:mm a')
        );
        setBestTimes(times);
        
        // Set default custom date to tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        setCustomDate(format(tomorrow, 'yyyy-MM-dd'));
        setCustomTime('12:00');
      });
    }
  }, [isOpen, task, getBestSlot]);

  if (!isOpen || !task) return null;

  const handleTimeSelect = async (timeOption: 'now' | 'best' | 'custom', customTimeStr?: string) => {
    setIsScheduling(true);
    
    try {
      let publishAt: string;
      
      if (timeOption === 'now') {
        publishAt = new Date().toISOString();
      } else if (timeOption === 'best') {
        const { bestDateTime } = await getBestSlot(task.post_type || 'facebook');
        publishAt = bestDateTime;
      } else {
        // Custom time
        const customDateTime = new Date(`${customDate}T${customTimeStr || customTime}`);
        publishAt = customDateTime.toISOString();
      }
      
      const result = await scheduleDraft({
        taskId: task.id,
        publishAt,
        platform: task.post_type || 'facebook'
      });
      
      if (result) {
        
        if (onScheduled) onScheduled();
        onClose();
      }
    } catch (error) {
      console.error('Error scheduling:', error);
      
    } finally {
      setIsScheduling(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold mb-4">Choose Posting Time</h3>
        <p className="text-gray-600 mb-6">
          When would you like to schedule this {task.post_type || 'post'}?
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
            <div className="font-medium mb-2">Custom Date & Time</div>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-600 block mb-1">Date</label>
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  disabled={isScheduling}
                  className="w-full border rounded px-2 py-1 disabled:opacity-50"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 block mb-1">Time</label>
                <input
                  type="time"
                  value={customTime}
                  onChange={(e) => setCustomTime(e.target.value)}
                  disabled={isScheduling}
                  className="w-full border rounded px-2 py-1 disabled:opacity-50"
                />
              </div>
              <Button
                onClick={() => handleTimeSelect('custom')}
                disabled={isScheduling || !customDate || !customTime}
                className="w-full bg-[#68BEB9] hover:bg-[#56a7a1] text-white"
              >
                Schedule for {customDate && customTime ? 
                  format(new Date(`${customDate}T${customTime}`), 'MMM d, h:mm a') : 
                  'Custom Time'
                }
              </Button>
            </div>
          </div>
        </div>
        
        <div className="flex gap-2 mt-6">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isScheduling}
            className="flex-1"
          >
            Cancel
          </Button>
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
