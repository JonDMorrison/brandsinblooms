import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Smartphone, Users, MessageSquare } from 'lucide-react';

interface SMSPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  message: string;
  segmentName: string;
  recipientCount: number;
}

export const SMSPreview: React.FC<SMSPreviewProps> = ({
  isOpen,
  onClose,
  message,
  segmentName,
  recipientCount
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-blue-600" />
            SMS Preview
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Campaign Info */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Target:</span>
            <Badge variant="secondary">{segmentName}</Badge>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Recipients:</span>
            <div className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              <span>{recipientCount}</span>
            </div>
          </div>
          
          {/* Phone Preview */}
          <div className="flex justify-center py-4">
            <div className="w-64 h-96 bg-gray-900 rounded-3xl p-4 shadow-2xl">
              <div className="w-full h-full bg-gray-100 rounded-2xl p-4 overflow-y-auto">
                <div className="space-y-2">
                  <div className="text-center text-xs text-gray-500 mb-4">
                    Garden Center
                  </div>
                  
                  <div className="bg-blue-500 text-white rounded-2xl rounded-bl-md px-4 py-2 max-w-[85%] ml-auto">
                    <div className="text-sm break-words">
                      {message || 'No message content'}
                      {message && (
                        <div className="text-xs opacity-80 mt-1 border-t border-blue-400 pt-1">
                          Reply STOP to unsubscribe
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-xs text-gray-500 text-right">
                    Delivered
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <Button onClick={onClose} className="w-full">
            Close Preview
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};