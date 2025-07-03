
import React, { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Facebook, Instagram, Clock, Calendar as CalendarIcon, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface GeneratedContent {
  id: string;
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED';
  caption: string;
  mediaUrl?: string;
  platform?: string;
  campaignId?: string;
  createdAt: string;
}

interface SocialConnection {
  id: string;
  platform: string;
  isActive: boolean;
  platformAccountName: string;
}

interface ComposerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedContent: GeneratedContent | null;
  socialConnections: SocialConnection[];
  onSchedule: (data: {
    contentId: string;
    caption: string;
    mediaUrl?: string;
    platforms: string[];
    publishAt: string;
  }) => void;
  onPublishNow: (data: {
    contentId: string;
    caption: string;
    mediaUrl?: string;
    platforms: string[];
  }) => void;
}

type SmartTimeOption = 'now' | 'best' | 'custom';

export const ComposerDrawer = ({ 
  isOpen, 
  onClose, 
  selectedContent, 
  socialConnections, 
  onSchedule, 
  onPublishNow 
}: ComposerDrawerProps) => {
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [smartTime, setSmartTime] = useState<SmartTimeOption>('best');
  const [customDate, setCustomDate] = useState<Date>();
  const [customTime, setCustomTime] = useState('12:00');

  // Debug social connections
  console.log('🔍 Social connections in ComposerDrawer:', socialConnections);
  
  const platforms = [
    {
      key: 'facebook',
      label: 'Facebook Page',
      icon: Facebook,
      available: socialConnections.some(c => c.platform === 'facebook' && c.isActive)
    },
    {
      key: 'instagram',
      label: 'Instagram',
      icon: Instagram,
      available: socialConnections.some(c => c.platform === 'instagram' && c.isActive)
    }
  ];
  
  console.log('🔍 Platform availability:', platforms.map(p => ({ key: p.key, available: p.available })));

  const togglePlatform = (platformKey: string) => {
    setSelectedPlatforms(prev => 
      prev.includes(platformKey)
        ? prev.filter(p => p !== platformKey)
        : [...prev, platformKey]
    );
  };

  const getSmartTimeLabel = (option: SmartTimeOption) => {
    switch (option) {
      case 'now':
        return 'Publish Now';
      case 'best':
        return 'Best Time';
      case 'custom':
        return 'Custom Time';
    }
  };

  const getPublishTime = (): string => {
    switch (smartTime) {
      case 'now':
        return new Date().toISOString();
      case 'best':
        // TODO: Implement best time algorithm
        const bestTime = new Date();
        bestTime.setHours(14, 0, 0, 0); // Default to 2 PM today
        return bestTime.toISOString();
      case 'custom':
        if (!customDate) return new Date().toISOString();
        const [hours, minutes] = customTime.split(':');
        const customDateTime = new Date(customDate);
        customDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        return customDateTime.toISOString();
      default:
        return new Date().toISOString();
    }
  };

  const handleSchedule = () => {
    if (!selectedContent || selectedPlatforms.length === 0) return;

    const publishAt = getPublishTime();
    
    onSchedule({
      contentId: selectedContent.id,
      caption: selectedContent.caption,
      mediaUrl: selectedContent.mediaUrl,
      platforms: selectedPlatforms,
      publishAt
    });
    
    onClose();
  };

  const handlePublishNow = () => {
    if (!selectedContent || selectedPlatforms.length === 0) return;

    onPublishNow({
      contentId: selectedContent.id,
      caption: selectedContent.caption,
      mediaUrl: selectedContent.mediaUrl,
      platforms: selectedPlatforms
    });
    
    onClose();
  };

  if (!selectedContent) return null;

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-[320px] bg-white">
        <SheetHeader>
          <SheetTitle className="text-[#3E5A6B]">Publish Settings</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Platform Selection */}
          <div className="space-y-3">
            <h3 className="font-medium text-[#3E5A6B]">Destinations</h3>
            <div className="space-y-2">
              {platforms.map((platform) => {
                const IconComponent = platform.icon;
                const isSelected = selectedPlatforms.includes(platform.key);
                const isAvailable = platform.available;
                
                return (
                  <div
                    key={platform.key}
                    onClick={() => isAvailable && togglePlatform(platform.key)}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all",
                      isAvailable 
                        ? "hover:border-[#68BEB9]/50" 
                        : "opacity-40 cursor-not-allowed",
                      isSelected && isAvailable 
                        ? "border-[#68BEB9] bg-[#68BEB9]/5" 
                        : "border-gray-200"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <IconComponent className="w-5 h-5 text-[#3E5A6B]" />
                      <div>
                        <p className="font-medium text-sm">{platform.label}</p>
                        {!isAvailable && (
                          <p className="text-xs text-gray-500">Not connected</p>
                        )}
                      </div>
                    </div>
                    
                    {isAvailable && (
                      <Switch
                        checked={isSelected}
                        onCheckedChange={() => togglePlatform(platform.key)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Smart Time Selection */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-[#3E5A6B]">Timing</h3>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-auto p-1">
                    <Info className="w-4 h-4 text-gray-400" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" align="start">
                  <div className="space-y-2">
                    <h4 className="font-medium">Smart-Time Explained</h4>
                    <p className="text-sm text-gray-600">
                      Our algorithm analyzes your audience activity patterns to suggest the optimal posting time for maximum engagement.
                    </p>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="space-y-2">
              {(['now', 'best', 'custom'] as SmartTimeOption[]).map((option) => (
                <Button
                  key={option}
                  variant={smartTime === option ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSmartTime(option)}
                  className={cn(
                    "w-full justify-start",
                    smartTime === option && [
                      "bg-[#68BEB9] hover:bg-[#56a7a1] text-white",
                      "shadow-lg shadow-[#68BEB9]/20"
                    ]
                  )}
                >
                  <Clock className="w-4 h-4 mr-2" />
                  {getSmartTimeLabel(option)}
                </Button>
              ))}
            </div>

            {/* Custom Time Picker */}
            {smartTime === 'custom' && (
              <div className="space-y-3 pt-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customDate ? format(customDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={customDate}
                      onSelect={setCustomDate}
                      disabled={(date) => date < new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                
                <input
                  type="time"
                  value={customTime}
                  onChange={(e) => setCustomTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#68BEB9] focus:border-transparent"
                />
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="space-y-3 pt-4">
            {smartTime === 'now' ? (
              <Button
                onClick={handlePublishNow}
                disabled={selectedPlatforms.length === 0}
                className="w-full bg-[#68BEB9] hover:bg-[#56a7a1] text-white"
              >
                Publish Now
              </Button>
            ) : (
              <Button
                onClick={handleSchedule}
                disabled={selectedPlatforms.length === 0}
                className="w-full bg-[#68BEB9] hover:bg-[#56a7a1] text-white"
              >
                Schedule Post
              </Button>
            )}
            
            <Button
              variant="outline"
              onClick={onClose}
              className="w-full border-[#3E5A6B] text-[#3E5A6B] hover:bg-[#3E5A6B]/5"
            >
              Cancel
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
