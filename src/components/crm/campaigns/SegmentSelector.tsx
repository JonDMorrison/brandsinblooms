
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/utils/toast';

interface Segment {
  id: string;
  name: string;
  customer_count: number;
  description?: string;
}

interface SegmentSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSegmentsSelected: (segments: Segment[]) => void;
  selectedSegments: Segment[];
}

export const SegmentSelector: React.FC<SegmentSelectorProps> = ({
  isOpen,
  onClose,
  onSegmentsSelected,
  selectedSegments
}) => {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(false);
  const [tempSelected, setTempSelected] = useState<Segment[]>([]);

  useEffect(() => {
    if (isOpen) {
      fetchSegments();
      setTempSelected(selectedSegments);
    }
  }, [isOpen, selectedSegments]);

  const fetchSegments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('crm_segments')
        .select('id, name, customer_count, description')
        .order('name');

      if (error) throw error;
      setSegments(data || []);
    } catch (error) {
      console.error('Error fetching segments:', error);
      toast.error('Failed to load segments');
    } finally {
      setLoading(false);
    }
  };

  const handleSegmentToggle = (segment: Segment) => {
    setTempSelected(prev => {
      const isSelected = prev.find(s => s.id === segment.id);
      if (isSelected) {
        return prev.filter(s => s.id !== segment.id);
      } else {
        return [...prev, segment];
      }
    });
  };

  const handleConfirm = () => {
    onSegmentsSelected(tempSelected);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Select Segments</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {loading ? (
            <div className="text-center py-4">Loading segments...</div>
          ) : segments.length === 0 ? (
            <div className="text-center py-4 text-gray-500">
              No segments found. Create segments first.
            </div>
          ) : (
            segments.map(segment => (
              <div key={segment.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                <Checkbox
                  checked={!!tempSelected.find(s => s.id === segment.id)}
                  onCheckedChange={() => handleSegmentToggle(segment)}
                />
                <div className="flex-1">
                  <div className="font-medium">{segment.name}</div>
                  <div className="text-sm text-gray-500">
                    {segment.customer_count} customers
                  </div>
                  {segment.description && (
                    <div className="text-sm text-gray-400 mt-1">
                      {segment.description}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex justify-end space-x-2 pt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>
            Select ({tempSelected.length})
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
