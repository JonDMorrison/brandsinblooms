import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, RotateCcw, User } from 'lucide-react';
import { useVersionHistory } from '@/hooks/useVersionHistory';
import { format } from 'date-fns';

interface BlockVersion {
  id: string;
  snapshot_json: any;
  created_at: string;
}

interface BlockVersionModalProps {
  open: boolean;
  onClose: () => void;
  blockId: string;
  campaignId: string;
  onRestore: (content: any, blockType: string) => void;
}

export const BlockVersionModal: React.FC<BlockVersionModalProps> = ({
  open,
  onClose,
  blockId,
  campaignId,
  onRestore
}) => {
  const { versions, loading, restoreVersion } = useVersionHistory(blockId, campaignId);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const handleRestore = async (version: BlockVersion) => {
    try {
      setRestoringId(version.id);
      const content = await restoreVersion(version.id);
      onRestore(content.content, content.block_type);
      onClose();
    } catch (error) {
      // Error handling is done in the hook
    } finally {
      setRestoringId(null);
    }
  };

  const getVersionSummary = (version: BlockVersion) => {
    const isManual = version.snapshot_json.metadata?.created_by === 'manual';
    const timestamp = format(new Date(version.created_at), 'MMM d, h:mm a');
    
    return {
      title: isManual ? 'Manual Save' : 'Auto Save',
      subtitle: timestamp,
      icon: isManual ? User : Clock
    };
  };

  const renderVersionPreview = (version: BlockVersion) => {
    const content = version.snapshot_json.content;
    
    // Simple preview based on block type
    if (version.snapshot_json.block_type === 'text') {
      return (
        <div className="text-sm text-gray-600 line-clamp-2">
          {content.html ? content.html.replace(/<[^>]*>/g, '').slice(0, 100) + '...' : 'Text block'}
        </div>
      );
    }
    
    if (version.snapshot_json.block_type === 'image') {
      return (
        <div className="text-sm text-gray-600">
          Image block {content.src ? `(${content.alt || 'No alt text'})` : '(No image)'}
        </div>
      );
    }
    
    return (
      <div className="text-sm text-gray-600">
        {version.snapshot_json.block_type} block
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Version History
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-96 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full"></div>
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No version history available</p>
              <p className="text-sm">Versions are created automatically every 5 minutes during editing</p>
            </div>
          ) : (
            versions.map((version, index) => {
              const summary = getVersionSummary(version);
              const IconComponent = summary.icon;
              
              return (
                <div
                  key={version.id}
                  className="border rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <IconComponent className="h-4 w-4 text-gray-500" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{summary.title}</span>
                          {index === 0 && (
                            <Badge variant="secondary" className="text-xs">
                              Current
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">{summary.subtitle}</div>
                      </div>
                    </div>
                    
                    {index > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRestore(version)}
                        disabled={restoringId === version.id}
                        className="gap-2"
                      >
                        {restoringId === version.id ? (
                          <div className="h-3 w-3 animate-spin border border-gray-400 border-t-transparent rounded-full" />
                        ) : (
                          <RotateCcw className="h-3 w-3" />
                        )}
                        Restore
                      </Button>
                    )}
                  </div>
                  
                  <div className="pl-7">
                    {renderVersionPreview(version)}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex justify-end pt-4">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};