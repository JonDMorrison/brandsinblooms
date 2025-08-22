// AUDIT: Updated ComposerDrawer to match new PublishItem contract and integrate MediaSelector + validation
// - Added props for PublishItem and callbacks for onSaveDraft, onPublishNow, onSchedule  
// - Integrated ImageSelectButton for media selection with DB persistence
// - Added validation using validatePostForPlatform utility
// - Added caption/firstComment editing with real-time preview
// - Mode switching between edit/publish/schedule

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { NativeSelect } from '@/components/ui/NativeSelect';
import { Facebook, Instagram, Clock, Calendar as CalendarIcon, Send, Save, AlertTriangle, Info, Eye } from 'lucide-react';
import { SocialPostPreviewModal } from './preview/SocialPostPreviewModal';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format, addHours, setHours, setMinutes } from 'date-fns';
import { ImageSelectButton } from '@/components/image';
import { validatePostForPlatform } from '@/utils/validatePost';
import type { PublishItem, PublishNowInput, ScheduleInput, ValidationResult } from '@/types/publish';

export type ComposerMode = "edit" | "publish" | "schedule";

export type ComposerDrawerProps = {
  open: boolean;
  mode: ComposerMode;              // initial intent; can be changed inside
  item: PublishItem | null;        // selected card
  accounts: Array<{               // available linked accounts for tenant
    platform: "facebook" | "instagram";
    accountId: string;             // Page ID or IG Business ID
    accountName: string;
  }>;

  // Callbacks provided by parent (PublishPage)
  onClose: () => void;

  // Persist edits to the source task (caption, mediaUrl, firstComment).
  // Return the updated item for optimistic UI.
  onSaveDraft: (taskId: string, partial: {
    caption?: string | null;
    mediaUrl?: string | null;
    firstComment?: string | null;
    accountId?: string | null;
  }) => Promise<PublishItem>;

  // Final actions: call the hook that invokes 'publish-task'
  onPublishNow: (taskId: string, input: PublishNowInput) => Promise<void>;
  onSchedule:   (taskId: string, input: ScheduleInput)   => Promise<void>;

  // Optional validation override (else use default validatePostForPlatform)
  validate?: (platform: "facebook" | "instagram", input: PublishNowInput) => ValidationResult;
};

export default function ComposerDrawer({
  open,
  mode: initialMode,
  item,
  accounts,
  onClose,
  onSaveDraft,
  onPublishNow,
  onSchedule,
  validate = validatePostForPlatform
}: ComposerDrawerProps) {
  const { toast } = useToast();
  
  // Local state
  const [mode, setMode] = useState<ComposerMode>(initialMode);
  const [localCaption, setLocalCaption] = useState('');
  const [localMediaUrl, setLocalMediaUrl] = useState<string | null>(null);
  const [localFirstComment, setLocalFirstComment] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date>(addHours(new Date(), 1));
  const [selectedTime, setSelectedTime] = useState<Date>(addHours(new Date(), 1));
  const [isLoading, setIsLoading] = useState(false);
  const [validation, setValidation] = useState<ValidationResult>({ ok: true, warnings: [], errors: [] });
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewPlatform, setPreviewPlatform] = useState<"instagram" | "facebook">("instagram");

  // Initialize local state when item changes
  useEffect(() => {
    if (item) {
      setLocalCaption(item.caption || '');
      setLocalMediaUrl(item.mediaUrl || null);
      setLocalFirstComment(item.firstComment || '');
      setSelectedAccountId(item.accountId || '');
      setMode(initialMode);
      setPreviewPlatform(item.platform);
      
      // Auto-select first available account for platform if none selected
      if (!item.accountId) {
        const matchingAccounts = accounts.filter(acc => acc.platform === item.platform);
        if (matchingAccounts.length > 0) {
          setSelectedAccountId(matchingAccounts[0].accountId);
        }
      }
    }
  }, [item, initialMode, accounts]);

  // Run validation when inputs change
  useEffect(() => {
    if (item && selectedAccountId) {
      const input: PublishNowInput = {
        platform: item.platform,
        accountId: selectedAccountId,
        caption: localCaption,
        mediaUrl: localMediaUrl,
        firstComment: localFirstComment
      };
      setValidation(validate(item.platform, input));
    }
  }, [item, localCaption, localMediaUrl, localFirstComment, selectedAccountId, validate]);

  if (!item) return null;

  const PlatformIcon = item.platform === 'facebook' ? Facebook : Instagram;
  const platformAccounts = accounts.filter(acc => acc.platform === item.platform);
  
  const hasChanges = localCaption !== (item.caption || '') || 
                    localMediaUrl !== (item.mediaUrl || null) ||
                    localFirstComment !== (item.firstComment || '') ||
                    selectedAccountId !== (item.accountId || '');

  const handleSave = async () => {
    if (!hasChanges) return;
    
    setIsLoading(true);
    try {
      await onSaveDraft(item.taskId, {
        caption: localCaption,
        mediaUrl: localMediaUrl,
        firstComment: localFirstComment,
        accountId: selectedAccountId
      });
      
      toast({
        title: "Saved",
        description: "Draft saved successfully",
      });
    } catch (error: any) {
      console.error('Save error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save draft",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePublishNow = async () => {
    if (!validation.ok) return;
    
    setIsLoading(true);
    try {
      // Save any unsaved changes first
      if (hasChanges) {
        await onSaveDraft(item.taskId, {
          caption: localCaption,
          mediaUrl: localMediaUrl,
          firstComment: localFirstComment,
          accountId: selectedAccountId
        });
      }
      
      await onPublishNow(item.taskId, {
        platform: item.platform,
        accountId: selectedAccountId,
        caption: localCaption,
        mediaUrl: localMediaUrl,
        firstComment: localFirstComment
      });
      
      toast({
        title: "Success!",
        description: "Published successfully",
      });
      
      // Don't close here - let parent handle closing after data refresh
    } catch (error: any) {
      console.error('Publish error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to publish",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSchedule = async () => {
    if (!validation.ok) return;
    
    setIsLoading(true);
    try {
      // Save any unsaved changes first
      if (hasChanges) {
        await onSaveDraft(item.taskId, {
          caption: localCaption,
          mediaUrl: localMediaUrl,
          firstComment: localFirstComment,
          accountId: selectedAccountId
        });
      }
      
      // Combine date and time
      const publishAt = new Date(selectedDate);
      publishAt.setHours(selectedTime.getHours());
      publishAt.setMinutes(selectedTime.getMinutes());
      publishAt.setSeconds(0);

      await onSchedule(item.taskId, {
        platform: item.platform,
        accountId: selectedAccountId,
        caption: localCaption,
        mediaUrl: localMediaUrl,
        firstComment: localFirstComment,
        publishAt: publishAt.toISOString()
      });
      
      toast({
        title: "Scheduled!",
        description: `Scheduled for ${format(publishAt, 'MMM d, h:mm a')}`,
      });
      
      // Don't close here - let parent handle closing after data refresh
    } catch (error: any) {
      console.error('Schedule error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to schedule",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

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
        <NativeSelect 
          value={currentHour.toString()} 
          onChange={(e) => onTimeChange(setHours(selectedTime, parseInt(e.target.value)))}
          className="w-20"
          options={hours.map(hour => ({
            value: hour.toString(),
            label: hour.toString().padStart(2, '0')
          }))}
        />
        
        <span className="text-gray-500">:</span>
        
        <NativeSelect 
          value={currentMinute.toString()} 
          onChange={(e) => onTimeChange(setMinutes(selectedTime, parseInt(e.target.value)))}
          className="w-20"
          options={minutes.map(minute => ({
            value: minute.toString(),
            label: minute.toString().padStart(2, '0')
          }))}
        />
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white z-50">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlatformIcon className={cn(
              "w-5 h-5",
              item.platform === 'facebook' ? 'text-blue-600' : 'text-pink-500'
            )} />
            {mode === 'edit' ? 'Edit Post' : mode === 'publish' ? 'Publish Now' : 'Schedule Post'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Mode Switcher */}
          <div className="flex gap-2">
            <Button 
              variant={mode === 'edit' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => setMode('edit')}
            >
              Edit
            </Button>
            <Button 
              variant={mode === 'publish' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => setMode('publish')}
            >
              Publish
            </Button>
            <Button 
              variant={mode === 'schedule' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => setMode('schedule')}
            >
              Schedule
            </Button>
          </div>

          {/* Account Selection */}
          {platformAccounts.length > 1 && (
            <div className="space-y-2">
              <Label>Account</Label>
              <NativeSelect
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                options={platformAccounts.map(acc => ({
                  value: acc.accountId,
                  label: acc.accountName
                }))}
              />
            </div>
          )}

          {/* Media Selection */}
          <div className="space-y-2">
            <Label>Image</Label>
            <ImageSelectButton
              selectedImageUrl={localMediaUrl || undefined}
              onImageSelect={async (url) => {
                setLocalMediaUrl(url);
                // Auto-save media selection
                try {
                  await onSaveDraft(item.taskId, { mediaUrl: url });
                } catch (error) {
                  console.error('Failed to save media:', error);
                }
              }}
              contentContext={localCaption || item.caption || ''}
              buttonText="Select Image"
              mode="modal"
            />
          </div>

          {/* Caption Editor */}
          <div className="space-y-2">
            <Label>Caption</Label>
            <Textarea
              value={localCaption}
              onChange={(e) => setLocalCaption(e.target.value)}
              placeholder="Write your caption..."
              className="min-h-[120px]"
              maxLength={item.platform === 'instagram' ? 2200 : 63206}
            />
            <div className="text-sm text-gray-500 text-right">
              {localCaption.length} / {item.platform === 'instagram' ? '2,200' : '63,206'} characters
            </div>
          </div>

          {/* First Comment (Instagram only) */}
          {item.platform === 'instagram' && (
            <div className="space-y-2">
              <Label>First Comment (Optional)</Label>
              <Input
                value={localFirstComment}
                onChange={(e) => setLocalFirstComment(e.target.value)}
                placeholder="Add a first comment..."
              />
            </div>
          )}

          {/* Schedule Settings */}
          {mode === 'schedule' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(selectedDate, "PPP")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => date && setSelectedDate(date)}
                      disabled={(date) => date < new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Time</Label>
                <TimePicker 
                  selectedTime={selectedTime}
                  onTimeChange={setSelectedTime}
                />
              </div>
            </div>
          )}

          {/* Validation Messages */}
          {(validation.errors.length > 0 || validation.warnings.length > 0) && (
            <div className="space-y-2">
              {validation.errors.map((error, i) => (
                <div key={i} className="flex items-center gap-2 text-red-600 text-sm">
                  <AlertTriangle className="w-4 h-4" />
                  {error}
                </div>
              ))}
              {validation.warnings.map((warning, i) => (
                <div key={i} className="flex items-center gap-2 text-yellow-600 text-sm">
                  <Info className="w-4 h-4" />
                  {warning}
                </div>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            {hasChanges && (
              <Button
                variant="outline"
                onClick={handleSave}
                disabled={isLoading}
              >
                <Save className="w-4 h-4 mr-1" />
                Save Draft
              </Button>
            )}

            <Button
              variant="outline"
              onClick={() => setPreviewOpen(true)}
              disabled={!localMediaUrl && !localCaption}
            >
              <Eye className="w-4 h-4 mr-1" />
              Preview
            </Button>
            
            {mode === 'publish' && (
              <Button
                onClick={handlePublishNow}
                disabled={!validation.ok || isLoading}
                className="flex-1"
              >
                <Send className="w-4 h-4 mr-1" />
                Publish Now
              </Button>
            )}
            
            {mode === 'schedule' && (
              <Button
                onClick={handleSchedule}
                disabled={!validation.ok || isLoading}
                className="flex-1"
              >
                <Clock className="w-4 h-4 mr-1" />
                Schedule Post
              </Button>
            )}
            
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>

          {/* Preview Modal */}
          {item && (
            <SocialPostPreviewModal
              open={previewOpen}
              onClose={() => setPreviewOpen(false)}
              platform={previewPlatform}
              onPlatformChange={setPreviewPlatform}
              accountName={platformAccounts.find(acc => acc.accountId === selectedAccountId)?.accountName || 'Account'}
              caption={localCaption || ''}
              mediaUrl={localMediaUrl || ''}
              scheduledFor={mode === 'schedule' ? 
                (() => {
                  const publishAt = new Date(selectedDate);
                  publishAt.setHours(selectedTime.getHours());
                  publishAt.setMinutes(selectedTime.getMinutes());
                  return publishAt.toISOString();
                })() : null
              }
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}