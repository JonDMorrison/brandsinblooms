import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/NativeSelect';
import { Calendar, Send, Clock, Loader2, Image } from 'lucide-react';
import { StatusIndicator } from '@/components/ui/status-indicator';
import { TASK_STATUS } from '@/constants/taskStatus';
import { format, addHours, addDays } from 'date-fns';
import { ImageSelectButton } from '@/components/image';

interface QuickPublishModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: any;
  socialConnections: any[];
  onPublish: (task: any, platform: string, scheduledTime?: Date) => Promise<void>;
}

export const QuickPublishModal = ({ 
  isOpen, 
  onClose, 
  task, 
  socialConnections,
  onPublish 
}: QuickPublishModalProps) => {
  const [selectedPlatform, setSelectedPlatform] = useState<string>('');
  const [publishMode, setPublishMode] = useState<'now' | 'scheduled'>('now');
  const [scheduledTime, setScheduledTime] = useState<string>('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [content, setContent] = useState(task?.ai_output || '');

  const getPostTypeIcon = (postType: string) => {
    switch (postType?.toLowerCase()) {
      case 'facebook': return '📘';
      case 'instagram': return '📷';
      case 'newsletter': return '📧';
      case 'video': return '🎬';
      default: return '📄';
    }
  };

  const getOptimalTimes = () => {
    const now = new Date();
    return [
      { label: 'In 2 hours (optimal)', value: format(addHours(now, 2), "yyyy-MM-dd'T'HH:mm") },
      { label: 'Tomorrow 9 AM', value: format(addDays(now, 1).setHours(9, 0, 0, 0), "yyyy-MM-dd'T'HH:mm") },
      { label: 'Tomorrow 2 PM', value: format(addDays(now, 1).setHours(14, 0, 0, 0), "yyyy-MM-dd'T'HH:mm") },
      { label: 'Tomorrow 6 PM', value: format(addDays(now, 1).setHours(18, 0, 0, 0), "yyyy-MM-dd'T'HH:mm") },
    ];
  };

  const handlePublish = async () => {
    if (!selectedPlatform) return;
    
    setIsPublishing(true);
    try {
      const scheduledDate = publishMode === 'scheduled' && scheduledTime 
        ? new Date(scheduledTime) 
        : undefined;
      
      await onPublish(task, selectedPlatform, scheduledDate);
      onClose();
    } catch (error) {
      console.error('Failed to publish:', error);
    } finally {
      setIsPublishing(false);
    }
  };

  if (!task) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-xl">{getPostTypeIcon(task.post_type)}</span>
            Quick Publish
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Content Preview */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Content</Label>
              <StatusIndicator status={TASK_STATUS.APPROVED} size="sm" />
            </div>
            <Textarea 
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[120px]"
              placeholder="Content to publish..."
            />
            </div>

            {/* Image Section */}
            <div>
              <Label className="flex items-center gap-2">
                <Image className="w-4 h-4" />
                Images
              </Label>
              <ImageSelectButton
                onImageSelect={async (imageUrl, metadata) => {
                  console.log('Image selected in quick publish:', imageUrl);
                  // The component handles database updates internally
                }}
                contentContext={content}
              />
            </div>

            {/* Platform Selection */}
          <div>
            <Label>Platform</Label>
            <NativeSelect 
              value={selectedPlatform} 
              onChange={(e) => setSelectedPlatform(e.target.value)}
              placeholder="Select platform to publish to"
              options={socialConnections.map((connection) => ({
                value: connection.platform,
                label: `${connection.platform.charAt(0).toUpperCase() + connection.platform.slice(1)}${
                  connection.platform_account_name ? ` - ${connection.platform_account_name}` : ''
                }`
              }))}
            />
            {socialConnections.length === 0 && (
              <p className="text-sm text-red-600 mt-1">
                No social accounts connected. Connect accounts in Settings.
              </p>
            )}
          </div>

          {/* Publishing Mode */}
          <div>
            <Label>When to publish</Label>
            <div className="flex gap-2 mt-2">
              <Button
                variant={publishMode === 'now' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPublishMode('now')}
              >
                <Send className="w-3 h-3 mr-1" />
                Publish Now
              </Button>
              <Button
                variant={publishMode === 'scheduled' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPublishMode('scheduled')}
              >
                <Calendar className="w-3 h-3 mr-1" />
                Schedule
              </Button>
            </div>
          </div>

          {/* Schedule Options */}
          {publishMode === 'scheduled' && (
            <div>
              <Label>Schedule for</Label>
              <NativeSelect 
                value={scheduledTime} 
                onChange={(e) => setScheduledTime(e.target.value)}
                placeholder="Choose optimal time"
                options={getOptimalTimes().map((time) => ({
                  value: time.value,
                  label: time.label
                }))}
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handlePublish}
              disabled={!selectedPlatform || isPublishing || socialConnections.length === 0}
            >
              {isPublishing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : publishMode === 'now' ? (
                <Send className="w-4 h-4 mr-2" />
              ) : (
                <Clock className="w-4 h-4 mr-2" />
              )}
              {isPublishing 
                ? 'Publishing...' 
                : publishMode === 'now' 
                  ? 'Publish Now' 
                  : 'Schedule Post'
              }
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};