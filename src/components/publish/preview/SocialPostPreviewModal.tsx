// src/components/publish/preview/SocialPostPreviewModal.tsx
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { InstagramPreview } from './InstagramPreview';
import { FacebookPreview } from './FacebookPreview';
import { getAspectHint, getValidationFor } from './useAspectInfo';
import { AlertTriangle, Info, Eye, X } from 'lucide-react';
import type { PreviewPlatform, PreviewProps } from './types';

interface SocialPostPreviewModalProps {
  open: boolean;
  onClose: () => void;
  platform: PreviewPlatform;
  onPlatformChange: (platform: PreviewPlatform) => void;
  accountName: string;
  avatarUrl?: string;
  caption: string;
  mediaUrl: string;
  scheduledFor?: string | null;
  likeCount?: number;
  commentCount?: number;
}

export const SocialPostPreviewModal = ({
  open,
  onClose,
  platform,
  onPlatformChange,
  accountName,
  avatarUrl,
  caption,
  mediaUrl,
  scheduledFor,
  likeCount,
  commentCount
}: SocialPostPreviewModalProps) => {
  const [aspectHint, setAspectHint] = useState<"1:1" | "4:5" | "16:9" | "other">("other");

  // Detect image aspect ratio
  useEffect(() => {
    if (mediaUrl) {
      const img = new Image();
      img.onload = () => {
        setAspectHint(getAspectHint(img.naturalWidth, img.naturalHeight));
      };
      img.src = mediaUrl;
    }
  }, [mediaUrl]);

  const validation = getValidationFor(platform, {
    captionLen: caption.length,
    aspectHint
  });

  const timeLabel = scheduledFor ? "Scheduled" : "Now";

  const previewProps: PreviewProps = {
    platform,
    accountName,
    avatarUrl,
    caption,
    mediaUrl,
    scheduledFor,
    likeCount,
    commentCount
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogClose asChild>
          <Button variant="ghost" size="icon" className="absolute right-4 top-4 h-6 w-6 z-10">
            <X className="h-4 w-4" />
          </Button>
        </DialogClose>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 pr-8">
            <Eye className="w-5 h-5" />
            Post Preview
            <Badge variant="outline" className="text-xs">
              {timeLabel}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Platform Tabs */}
          <div className="flex gap-2">
            <Button
              variant={platform === 'instagram' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onPlatformChange('instagram')}
            >
              Instagram
            </Button>
            <Button
              variant={platform === 'facebook' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onPlatformChange('facebook')}
            >
              Facebook
            </Button>
          </div>

          {/* Validation Chips */}
          {(validation.errors.length > 0 || validation.warns.length > 0) && (
            <div className="space-y-2">
              {validation.errors.map((error, i) => (
                <div key={i} className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-2 rounded">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              ))}
              {validation.warns.map((warning, i) => (
                <div key={i} className="flex items-center gap-2 text-yellow-600 text-sm bg-yellow-50 p-2 rounded">
                  <Info className="w-4 h-4 flex-shrink-0" />
                  {warning}
                </div>
              ))}
            </div>
          )}

          {/* Preview Body */}
          <div className="flex justify-center p-8 bg-gray-50 rounded-lg">
            {platform === 'instagram' ? (
              <InstagramPreview {...previewProps} platform="instagram" />
            ) : (
              <FacebookPreview {...previewProps} platform="facebook" />
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};