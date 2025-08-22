import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Send, Save, Eye, Users, Sparkles } from 'lucide-react';
import { SenderStatusIndicator } from './campaigns/SenderStatusIndicator';
import { SaveIndicator } from './SaveIndicator';
import { ShortenAllBlocksButton } from './ShortenAllBlocksButton';
import type { SenderConfig } from '@/hooks/useSenderConfiguration';
import type { ContentBlock } from '@/types/emailBuilder';

interface CampaignActionBarProps {
  // Campaign status
  campaignName: string;
  subjectLine: string;
  blocks: ContentBlock[];
  selectedSegments: any[];
  
  // Sender info
  senderConfig?: SenderConfig;
  loadingSenderConfig: boolean;
  
  // Save status
  lastSaved?: Date;
  isAutoSaving: boolean;
  saveError: boolean;
  
  // Loading states
  sending: boolean;
  loading: boolean;
  
  // Actions
  onSend: () => void;
  onSave: () => void;
  onPreview: () => void;
  onAudience: () => void;
  onAIWriter: () => void;
  onBlockUpdate?: (blockId: string, updatedBlock: ContentBlock) => void;
  
  className?: string;
}

export const CampaignActionBar: React.FC<CampaignActionBarProps> = ({
  campaignName,
  subjectLine,
  blocks,
  selectedSegments,
  senderConfig,
  loadingSenderConfig,
  lastSaved,
  isAutoSaving,
  saveError,
  sending,
  loading,
  onSend,
  onSave,
  onPreview,
  onAudience,
  onAIWriter,
  onBlockUpdate,
  className = ''
}) => {
  // Calculate readiness
  const isReady = campaignName?.trim() && 
                  subjectLine?.trim() && 
                  blocks.length > 0 &&
                  selectedSegments.length > 0;

  return (
    <div className={`sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b ${className}`}>
      <div className="max-w-full mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Left side - Status indicators */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
            <SaveIndicator
                lastSaved={lastSaved}
                saving={isAutoSaving}
                error={saveError}
              />
            </div>
            
            {senderConfig && (
              <SenderStatusIndicator 
                senderConfig={senderConfig}
                compact={true}
                className="text-xs"
              />
            )}
            
            {selectedSegments.length > 0 && (
              <Badge variant="outline" className="flex items-center space-x-1">
                <Users className="h-3 w-3" />
                <span>{selectedSegments.length} audience{selectedSegments.length !== 1 ? 's' : ''}</span>
              </Badge>
            )}
          </div>

          {/* Right side - Actions */}
          <div className="flex items-center space-x-3">
            {/* Secondary actions */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onAIWriter}
              disabled={loading}
              className="flex items-center space-x-2"
            >
              <Sparkles className="h-4 w-4" />
              <span>Write with AI</span>
            </Button>

            {onBlockUpdate && (
              <ShortenAllBlocksButton
                blocks={blocks}
                campaignName={campaignName}
                onUpdate={onBlockUpdate}
              />
            )}


            <Button
              variant="outline"
              size="sm"
              onClick={onPreview}
              disabled={loading}
              className="flex items-center space-x-2"
            >
              <Eye className="h-4 w-4" />
              <span>Preview</span>
            </Button>

            {/* Primary actions */}
            <Button
              variant="outline"
              size="sm"
              onClick={onSave}
              disabled={loading || isAutoSaving}
              className="flex items-center space-x-2"
            >
              <Save className="h-4 w-4" />
              <span>Save</span>
            </Button>

            <Button
              onClick={onSend}
              disabled={!isReady || sending || loading || loadingSenderConfig}
              size="sm"
              className="flex items-center space-x-2"
            >
              {sending ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  <span>Send</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};