import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { 
  Send, 
  Clock, 
  Image, 
  Facebook, 
  Instagram, 
  Calendar as CalendarIcon,
  Zap,
  CheckCircle,
  AlertCircle,
  Loader2,
  Settings,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { addHours, format, setHours, setMinutes } from 'date-fns';

interface GeneratedContent {
  id: string;
  status: string;
  caption: string;
  mediaUrl?: string;
  platform?: string;
  campaignId?: string;
  createdAt: string;
  imageSource?: string;
  photographer?: string;
}

interface SocialConnection {
  id: string;
  platform: string;
  platform_account_name: string | null;
  is_active: boolean;
  page_id: string | null;
  platform_account_id: string;
  access_token: string;
  created_at: string;
  deleted_at: string | null;
  expires_at: string | null;
  refresh_token: string | null;
  updated_at: string;
  user_id: string;
  username: string | null;
}

interface DirectSocialPublisherProps {
  selectedContent: GeneratedContent | null;
  onPublishSuccess?: () => void;
  onScheduleSuccess?: () => void;
}

// Platform selector component
const PlatformSelector = ({ 
  connections, 
  selectedPlatforms, 
  onPlatformToggle 
}: {
  connections: SocialConnection[];
  selectedPlatforms: string[];
  onPlatformToggle: (platform: string) => void;
}) => {
  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">Select Platforms</Label>
      <div className="grid gap-3">
        {connections.map((connection) => {
          const isSelected = selectedPlatforms.includes(connection.platform);
          const PlatformIcon = connection.platform === 'facebook' ? Facebook : Instagram;
          const platformName = connection.platform === 'facebook' ? 'Facebook' : 'Instagram';
          
          return (
            <div
              key={connection.id}
              onClick={() => onPlatformToggle(connection.platform)}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                isSelected 
                  ? "border-primary bg-primary/5" 
                  : "border-gray-200 hover:border-gray-300"
              )}
            >
              <div className="flex items-center gap-3 flex-1">
                <PlatformIcon className={cn(
                  "w-5 h-5",
                  connection.platform === 'facebook' ? 'text-blue-600' : 'text-pink-500'
                )} />
                <div>
                  <p className="font-medium text-sm">{platformName}</p>
                  <p className="text-xs text-gray-500">{connection.platform_account_name}</p>
                </div>
              </div>
              <div className={cn(
                "w-4 h-4 rounded-full border-2 transition-all",
                isSelected 
                  ? "bg-primary border-primary" 
                  : "border-gray-300"
              )}>
                {isSelected && <CheckCircle className="w-3 h-3 text-white" />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Time picker component
const TimePicker = ({ 
  selectedTime, 
  onTimeChange 
}: { 
  selectedTime: Date; 
  onTimeChange: (time: Date) => void; 
}) => {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = [0, 15, 30, 45];
  
  const currentHour = selectedTime.getHours();
  const currentMinute = selectedTime.getMinutes();
  
  return (
    <div className="flex items-center gap-2">
      <Select 
        value={currentHour.toString()} 
        onValueChange={(value) => onTimeChange(setHours(selectedTime, parseInt(value)))}
      >
        <SelectTrigger className="w-20">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {hours.map(hour => (
            <SelectItem key={hour} value={hour.toString()}>
              {hour.toString().padStart(2, '0')}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      <span className="text-gray-500">:</span>
      
      <Select 
        value={currentMinute.toString()} 
        onValueChange={(value) => onTimeChange(setMinutes(selectedTime, parseInt(value)))}
      >
        <SelectTrigger className="w-20">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {minutes.map(minute => (
            <SelectItem key={minute} value={minute.toString()}>
              {minute.toString().padStart(2, '0')}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export const DirectSocialPublisher = ({ 
  selectedContent, 
  onPublishSuccess,
  onScheduleSuccess 
}: DirectSocialPublisherProps) => {
  const { user } = useAuth();
  const [connections, setConnections] = useState<SocialConnection[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [isPublishing, setIsPublishing] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(addHours(new Date(), 1));
  const [selectedTime, setSelectedTime] = useState<Date>(addHours(new Date(), 1));
  const [isScheduling, setIsScheduling] = useState(false);
  const [editedCaption, setEditedCaption] = useState('');
  const [autoImage, setAutoImage] = useState(true);

  // Load connections and set initial state
  useEffect(() => {
    if (selectedContent) {
      setEditedCaption(selectedContent.caption);
      loadConnections();
    }
  }, [selectedContent]);

  const loadConnections = async () => {
    try {
      const { data, error } = await supabase
        .from('social_connections')
        .select('*')
        .eq('is_active', true)
        .in('platform', ['facebook', 'instagram']);

      if (error) throw error;
      
      const validConnections = (data || []).filter(
        (conn): conn is SocialConnection => 
          conn.platform === 'facebook' || conn.platform === 'instagram'
      );
      
      setConnections(validConnections);
      
      // Pre-select platforms based on content type
      if (selectedContent?.platform) {
        setSelectedPlatforms([selectedContent.platform]);
      } else {
        setSelectedPlatforms(validConnections.map(c => c.platform));
      }
    } catch (error) {
      console.error('Error loading connections:', error);
      toast.error('Failed to load social media connections');
    }
  };

  const handlePlatformToggle = (platform: string) => {
    setSelectedPlatforms(prev => 
      prev.includes(platform) 
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    );
  };

  const handlePublishNow = async () => {
    if (!selectedContent || selectedPlatforms.length === 0) {
      toast.error('Please select at least one platform');
      return;
    }

    setIsPublishing(true);
    try {
      // Update content with edited caption if changed
      if (editedCaption !== selectedContent.caption) {
        await supabase
          .from('content_tasks')
          .update({ ai_output: editedCaption })
          .eq('id', selectedContent.id);
      }

      const { data, error } = await supabase.functions.invoke('publish-task', {
        body: {
          taskId: selectedContent.id,
          platforms: selectedPlatforms,
          // Force use of existing image if available, disable auto-fetch if image exists
          autoImage: selectedContent.mediaUrl ? false : autoImage,
          // Pass the exact image URL if we have one to ensure consistency
          imageUrl: selectedContent.mediaUrl
        }
      });

      if (error) throw error;

      if (data?.success) {
        const successCount = data.results?.filter((r: any) => r.success).length || 0;
        const totalCount = data.results?.length || 0;
        
        if (successCount === totalCount) {
          toast.success(`Successfully published to ${totalCount} platform(s)!`);
        } else if (successCount > 0) {
          toast.success(`Published to ${successCount}/${totalCount} platforms`);
        } else {
          toast.error('Publishing failed on all platforms');
        }
        
        onPublishSuccess?.();
      } else {
        toast.error(data?.message || 'Publishing failed');
      }
    } catch (error: any) {
      console.error('Publishing error:', error);
      toast.error(error.message || 'Failed to publish content');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleSchedulePost = async () => {
    if (!selectedContent || selectedPlatforms.length === 0) {
      toast.error('Please select at least one platform');
      return;
    }

    setIsScheduling(true);
    try {
      // Combine date and time
      const publishAt = new Date(selectedDate);
      publishAt.setHours(selectedTime.getHours());
      publishAt.setMinutes(selectedTime.getMinutes());
      publishAt.setSeconds(0);

      // Update content with edited caption if changed
      if (editedCaption !== selectedContent.caption) {
        await supabase
          .from('content_tasks')
          .update({ ai_output: editedCaption })
          .eq('id', selectedContent.id);
      }

      const { data, error } = await supabase.functions.invoke('publish-task', {
        body: {
          taskId: selectedContent.id,
          platforms: selectedPlatforms,
          publishAt: publishAt.toISOString(),
          // Force use of existing image if available, disable auto-fetch if image exists
          autoImage: selectedContent.mediaUrl ? false : autoImage,
          // Pass the exact image URL if we have one to ensure consistency
          imageUrl: selectedContent.mediaUrl
        }
      });

      if (error) throw error;

      if (data?.success) {
        const successCount = data.results?.filter((r: any) => r.success).length || 0;
        const formattedTime = format(publishAt, 'MMM d, h:mm a');
        
        if (successCount > 0) {
          toast.success(`Scheduled for ${formattedTime}!`);
          setShowScheduleDialog(false);
          onScheduleSuccess?.();
        } else {
          toast.error('Scheduling failed on all platforms');
        }
      } else {
        toast.error(data?.message || 'Scheduling failed');
      }
    } catch (error: any) {
      console.error('Scheduling error:', error);
      toast.error(error.message || 'Failed to schedule content');
    } finally {
      setIsScheduling(false);
    }
  };

  if (!selectedContent) {
    return (
      <Card className="p-6 text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Send className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-700 mb-2">Ready to Publish</h3>
        <p className="text-gray-600 text-sm">
          Select content from the library to publish or schedule to social media
        </p>
      </Card>
    );
  }

  if (connections.length === 0) {
    return (
      <Card className="p-6 text-center border-orange-200 bg-orange-50">
        <AlertCircle className="w-12 h-12 text-orange-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-orange-800 mb-2">No Social Connections</h3>
        <p className="text-orange-700 text-sm mb-4">
          Connect your Facebook and Instagram accounts to publish content directly
        </p>
        <Button 
          variant="outline" 
          className="border-orange-300 text-orange-700 hover:bg-orange-100"
          onClick={() => window.location.href = '/social'}
        >
          <Settings className="w-4 h-4 mr-2" />
          Connect Accounts
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Enhanced Content Preview with Image Source Info */}
      <Card className="p-4">
        <div className="flex items-start gap-4">
          {selectedContent.mediaUrl && (
            <div className="flex-shrink-0">
              <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-100 relative">
                <img 
                  src={selectedContent.mediaUrl} 
                  alt="Content preview"
                  className="w-full h-full object-cover"
                />
                {/* Image source indicator */}
                {selectedContent.imageSource && (
                  <div className="absolute top-1 right-1 bg-black bg-opacity-75 text-white text-xs px-1 py-0.5 rounded">
                    {selectedContent.imageSource === 'unsplash' ? '📷' : '🖼️'}
                  </div>
                )}
              </div>
              {/* Image metadata */}
              {selectedContent.imageSource && (
                <div className="mt-1 text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <span className="font-medium">Source:</span>
                    <span className="capitalize">{selectedContent.imageSource}</span>
                  </div>
                  {selectedContent.photographer && (
                    <div className="text-xs text-gray-400 truncate max-w-20" title={selectedContent.photographer}>
                      by {selectedContent.photographer}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="capitalize">
                {selectedContent.platform || 'Social'}
              </Badge>
              <Badge variant="secondary">{selectedContent.status}</Badge>
              {/* Image preview confirmation */}
              {selectedContent.mediaUrl && (
                <Badge variant="outline" className="text-green-700 border-green-200 bg-green-50">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Image Ready
                </Badge>
              )}
            </div>
            <Textarea
              value={editedCaption}
              onChange={(e) => setEditedCaption(e.target.value)}
              className="min-h-[100px] text-sm"
              placeholder="Edit caption before publishing..."
            />
            {/* Image posting confirmation */}
            {selectedContent.mediaUrl && (
              <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
                ✅ This exact image will be posted to social media
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Platform Selection */}
      <Card className="p-4">
        <PlatformSelector 
          connections={connections}
          selectedPlatforms={selectedPlatforms}
          onPlatformToggle={handlePlatformToggle}
        />
      </Card>

      {/* Publishing Options */}
      <Card className="p-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Auto-fetch images</Label>
            <Switch 
              checked={autoImage} 
              onCheckedChange={setAutoImage}
            />
          </div>
          
          {/* Enhanced image status info */}
          {selectedContent.mediaUrl ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <p className="text-sm text-green-800">
                  <strong>Image confirmed:</strong> The image shown above will be posted to social media
                </p>
              </div>
              {selectedContent.photographer && (
                <p className="text-xs text-green-700 mt-1">
                  📸 Photo by {selectedContent.photographer}
                </p>
              )}
            </div>
          ) : autoImage ? (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <Image className="w-4 h-4 text-blue-600" />
                <p className="text-sm text-blue-800">
                  An image will be automatically fetched from Unsplash for better engagement
                </p>
              </div>
              <p className="text-xs text-blue-600 mt-1">
                ⚠️ Note: Auto-fetched image may differ from any images shown in content preview
              </p>
            </div>
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-600" />
                <p className="text-sm text-yellow-800">
                  No image will be included (Instagram posts require images)
                </p>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handlePublishNow}
          disabled={isPublishing || selectedPlatforms.length === 0}
          className="flex-1 bg-green-600 hover:bg-green-700"
        >
          {isPublishing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Publishing...
            </>
          ) : (
            <>
              <Zap className="w-4 h-4 mr-2" />
              Publish Now
            </>
          )}
        </Button>
        
        <Button
          onClick={() => setShowScheduleDialog(true)}
          disabled={selectedPlatforms.length === 0}
          variant="outline"
          className="flex-1"
        >
          <CalendarIcon className="w-4 h-4 mr-2" />
          Schedule Post
        </Button>
      </div>

      {/* Schedule Dialog */}
      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5" />
              Schedule Post
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Date</Label>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                disabled={(date) => date < new Date()}
                className="rounded-md border"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Select Time</Label>
              <TimePicker 
                selectedTime={selectedTime}
                onTimeChange={setSelectedTime}
              />
            </div>

            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm text-gray-600">
                <Clock className="w-4 h-4 inline mr-1" />
                Will publish on {format(selectedDate, 'MMM d, yyyy')} at {format(selectedTime, 'h:mm a')}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button
                onClick={handleSchedulePost}
                disabled={isScheduling}
                className="flex-1"
              >
                {isScheduling ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Scheduling...
                  </>
                ) : (
                  'Schedule Post'
                )}
              </Button>
              
              <Button
                onClick={() => setShowScheduleDialog(false)}
                variant="outline"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};