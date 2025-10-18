import React, { useState, useEffect, useRef } from 'react';
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
  const [isSticky, setIsSticky] = useState(false);
  const stickyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsSticky(!entry.isIntersecting);
      },
      { threshold: 1 }
    );

    if (stickyRef.current) {
      observer.observe(stickyRef.current);
    }

    return () => {
      if (stickyRef.current) {
        observer.unobserve(stickyRef.current);
      }
    };
  }, []);

  // Calculate readiness (audience defaults to All Contacts)
  const isReady = Boolean(
    campaignName?.trim() &&
    subjectLine?.trim() &&
    blocks.length > 0
  );

  return (
    <>
      <div ref={stickyRef} className="h-0" />
      <div className={`sticky top-0 z-50 ${isSticky ? 'flex justify-end' : 'w-full'} ${className}`}>
        <div className={`${isSticky ? 'inline-flex px-4 py-2 backdrop-blur-sm rounded-md shadow-sm' : 'w-full -mx-8 px-6 py-4 backdrop-blur-sm border-b'}`} style={{ backgroundColor: '#fbf9f4' }}>
          <div className={`flex items-center ${isSticky ? '' : 'justify-between'}`}>
            {/* Left side - Status indicators */}
            {!isSticky && (
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
            )}

            {/* Right side - Actions */}
            <div className={`flex items-center ${isSticky ? 'space-x-0' : 'space-x-3'}`}>
              {/* Secondary actions - hidden when sticky */}
              {!isSticky && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onAIWriter}
                    disabled={loading}
                    className="flex items-center space-x-2"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>Regenerate with AI</span>
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
                </>
              )}

              {/* Save button - always visible */}
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

              {/* Send button - hidden when sticky */}
              {!isSticky && (
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
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};