import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Users, Target } from 'lucide-react';

interface Segment {
  id: string;
  name: string;
  description?: string;
  conditions: any;
  customer_count: number;
  auto_update: boolean;
  created_at: string;
}

interface SegmentDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  segment: Segment | null;
  onSegmentUpdate?: () => void;
}

export const SegmentDetailsModal: React.FC<SegmentDetailsModalProps> = ({
  open,
  onOpenChange,
  segment
}) => {
  if (!segment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <Target className="h-6 w-6 text-primary" />
            <div>
              <DialogTitle className="text-xl">{segment.name}</DialogTitle>
              {segment.description && (
                <p className="text-sm text-muted-foreground mt-1">
                  {segment.description}
                </p>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Summary Section */}
          <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <span className="font-semibold">{segment.customer_count || 0} Customers</span>
            </div>
            {segment.auto_update && (
              <Badge variant="outline">Auto-update</Badge>
            )}
            <div className="text-xs text-muted-foreground ml-auto">
              Created {new Date(segment.created_at).toLocaleDateString()}
            </div>
          </div>

          {/* Segment Information */}
          <div className="p-4 border rounded-lg">
            <h3 className="font-semibold mb-2">Segment Details</h3>
            <p className="text-sm text-muted-foreground">
              This segment automatically groups customers based on predefined criteria. 
              Customer assignment is managed automatically by the system.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};