import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Users, Target, Settings } from 'lucide-react';
import { CustomSegmentBuilder } from '@/components/crm/CustomSegmentBuilder';
import { supabase } from '@/integrations/supabase/client';

interface CustomSegmentModalProps {
  open: boolean;
  onSave: (segmentData: { name: string; filters: any[] }) => void;
  onCancel: () => void;
}

export const CustomSegmentModal: React.FC<CustomSegmentModalProps> = ({
  open,
  onSave,
  onCancel
}) => {
  const [segmentData, setSegmentData] = useState<{ name: string; filters: any[] } | null>(null);
  const [estimatedCount, setEstimatedCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSegmentChange = (data: { name: string; filters: any[] }) => {
    setSegmentData(data);
    // Calculate estimated customer count based on filters
    calculateEstimatedCount(data.filters);
  };

  const calculateEstimatedCount = async (filters: any[]) => {
    if (!filters || filters.length === 0) {
      setEstimatedCount(null);
      return;
    }

    setLoading(true);
    try {
      // Get total customer count for estimation
      const { count, error } = await supabase
        .from('crm_customers')
        .select('*', { count: 'exact', head: true });

      if (error) throw error;

      // Simple estimation logic - in reality this would be more sophisticated
      // For now, just show a percentage based on filter complexity
      const complexityFactor = Math.min(filters.length * 0.3, 0.8);
      const estimated = Math.round((count || 0) * (1 - complexityFactor));
      setEstimatedCount(Math.max(estimated, 1));
    } catch (error) {
      console.error('Error calculating estimate:', error);
      setEstimatedCount(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    if (segmentData) {
      onSave(segmentData);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onCancel}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <Target className="h-6 w-6 text-primary" />
            <div>
              <DialogTitle className="text-xl">Create Custom Segment</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Define custom criteria to segment your customers
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Summary Section */}
          {segmentData && segmentData.name && (
            <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg mb-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <span className="font-semibold">
                  {loading ? (
                    <span className="animate-pulse">Calculating...</span>
                  ) : estimatedCount !== null ? (
                    `~${estimatedCount} customers`
                  ) : (
                    'Add filters to see estimate'
                  )}
                </span>
              </div>
              <Badge variant="outline" className="flex items-center gap-1">
                <Settings className="h-3 w-3" />
                Custom Segment
              </Badge>
              {segmentData.filters.length > 0 && (
                <Badge variant="secondary">
                  {segmentData.filters.length} {segmentData.filters.length === 1 ? 'filter' : 'filters'}
                </Badge>
              )}
            </div>
          )}

          <Separator className="mb-4" />

          {/* Segment Builder */}
          <div className="flex-1 overflow-y-auto">
            <CustomSegmentBuilder 
              onSave={handleSegmentChange} 
              onCancel={onCancel}
              onChange={handleSegmentChange}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              disabled={!segmentData || !segmentData.name.trim() || segmentData.filters.length === 0}
            >
              Create Segment
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};