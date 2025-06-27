
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Clock, Sparkles, Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';

interface TimePopoverProps {
  isOpen: boolean;
  onClose: () => void;
  onSchedule: (date: Date, time: 'now' | 'best' | string) => void;
  targetDate: Date;
  bestTimes: string[];
}

export const TimePopover = ({ 
  isOpen, 
  onClose, 
  onSchedule, 
  targetDate,
  bestTimes = ['12:00', '15:00', '18:00']
}: TimePopoverProps) => {
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [customTime, setCustomTime] = useState<string>('12:00');

  const handleScheduleNow = () => {
    onSchedule(new Date(), 'now');
    onClose();
  };

  const handleScheduleBest = () => {
    onSchedule(targetDate, 'best');
    onClose();
  };

  const handleScheduleCustom = () => {
    const [hours, minutes] = customTime.split(':').map(Number);
    const scheduledDate = new Date(targetDate);
    scheduledDate.setHours(hours, minutes, 0, 0);
    onSchedule(scheduledDate, customTime);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white/90 backdrop-blur-md rounded-xl shadow-lg p-6 max-w-sm w-full mx-4 border border-white/20">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-[#3E5A6B] mb-2">Schedule Post</h3>
          <p className="text-sm text-gray-600">
            Schedule for {format(targetDate, 'EEEE, MMMM d')}
          </p>
        </div>

        <div className="space-y-3">
          {/* Schedule Now */}
          <Button
            onClick={handleScheduleNow}
            className="w-full justify-start bg-[#68BEB9] hover:bg-[#5AA8A3] text-white"
          >
            <Clock className="w-4 h-4 mr-2" />
            Post Now
          </Button>

          {/* Best Time */}
          <Button
            onClick={handleScheduleBest}
            variant="outline"
            className="w-full justify-start border-[#68BEB9] text-[#68BEB9] hover:bg-[#68BEB9]/10"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Best Time ({bestTimes[0]})
          </Button>

          {/* Custom Time */}
          <div className="border border-gray-200 rounded-lg p-3">
            <Label className="text-sm font-medium text-[#3E5A6B] mb-2 block">
              Custom Time
            </Label>
            <div className="flex gap-2">
              <Input
                type="time"
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
                className="flex-1"
              />
              <Button
                onClick={handleScheduleCustom}
                size="sm"
                variant="outline"
                className="border-[#68BEB9] text-[#68BEB9]"
              >
                <CalendarIcon className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Best Times Info */}
          {bestTimes.length > 1 && (
            <div className="text-xs text-gray-500 bg-[#68BEB9]/5 rounded-lg p-2">
              <span className="font-medium">Suggested times:</span> {bestTimes.join(', ')}
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-4">
          <Button variant="ghost" onClick={onClose} className="flex-1">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
};
