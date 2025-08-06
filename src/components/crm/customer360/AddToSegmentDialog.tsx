import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Plus, Users } from 'lucide-react';

interface AddToSegmentDialogProps {
  customer: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
  };
  open: boolean;
  onClose: () => void;
}

interface Segment {
  id: string;
  name: string;
  description: string | null;
  count_cached: number;
  is_active: boolean;
}

export const AddToSegmentDialog = ({ customer, open, onClose }: AddToSegmentDialogProps) => {
  const [selectedSegments, setSelectedSegments] = useState<string[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch available segments
  const { data: segments = [], isLoading } = useQuery({
    queryKey: ['segments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('segments')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data as Segment[];
    },
    enabled: open,
  });

  // Fetch customer's current segments
  const { data: customerSegments = [] } = useQuery({
    queryKey: ['customer-segments', customer.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_segments')
        .select('segment_id')
        .eq('customer_id', customer.id);

      if (error) throw error;
      return data.map(cs => cs.segment_id);
    },
    enabled: open,
  });

  const addToSegmentsMutation = useMutation({
    mutationFn: async ({ segmentIds }: { segmentIds: string[] }) => {
      // Get current user
      const { data: userData } = await supabase.auth.getUser();
      
      // Add customer to selected segments
      const insertData = segmentIds.map(segmentId => ({
        customer_id: customer.id,
        segment_id: segmentId,
        assigned_by_user_id: userData.user?.id,
      }));

      const { error } = await supabase
        .from('customer_segments')
        .upsert(insertData, { 
          onConflict: 'customer_id,segment_id' 
        });

      if (error) throw error;

      return { success: true };
    },
    onSuccess: () => {
      toast({
        title: "Added to Segments",
        description: `Customer added to ${selectedSegments.length} segment${selectedSegments.length !== 1 ? 's' : ''}`,
      });
      
      // Refresh segments data
      queryClient.invalidateQueries({ queryKey: ['customer-segments'] });
      queryClient.invalidateQueries({ queryKey: ['segments'] });
      
      setSelectedSegments([]);
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Add to Segments",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSegmentToggle = (segmentId: string, checked: boolean) => {
    if (checked) {
      setSelectedSegments(prev => [...prev, segmentId]);
    } else {
      setSelectedSegments(prev => prev.filter(id => id !== segmentId));
    }
  };

  const handleAddToSegments = () => {
    if (selectedSegments.length === 0) {
      toast({
        title: "No Segments Selected",
        description: "Please select at least one segment",
        variant: "destructive",
      });
      return;
    }

    addToSegmentsMutation.mutate({ segmentIds: selectedSegments });
  };

  const getCustomerName = () => {
    if (customer.first_name && customer.last_name) {
      return `${customer.first_name} ${customer.last_name}`;
    }
    if (customer.first_name) {
      return customer.first_name;
    }
    return customer.email;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Add to Segments
          </DialogTitle>
          <DialogDescription>
            Add {getCustomerName()} to customer segments for targeted campaigns
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse h-12 bg-muted rounded" />
              ))}
            </div>
          ) : segments.length === 0 ? (
            <div className="text-center py-6">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No segments available</p>
              <p className="text-sm text-muted-foreground mt-1">
                Create segments to organize your customers
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {segments.map((segment) => {
                const isCurrentlyInSegment = customerSegments.includes(segment.id);
                const isSelected = selectedSegments.includes(segment.id);
                
                return (
                  <div
                    key={segment.id}
                    className={`flex items-start space-x-3 p-3 rounded-lg border ${
                      isCurrentlyInSegment 
                        ? 'bg-muted border-muted-foreground/20' 
                        : 'hover:bg-muted/50'
                    }`}
                  >
                    <Checkbox
                      id={segment.id}
                      checked={isSelected}
                      onCheckedChange={(checked) => 
                        handleSegmentToggle(segment.id, checked as boolean)
                      }
                      disabled={isCurrentlyInSegment}
                    />
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <Label
                          htmlFor={segment.id}
                          className={`font-medium cursor-pointer ${
                            isCurrentlyInSegment ? 'text-muted-foreground' : ''
                          }`}
                        >
                          {segment.name}
                        </Label>
                        {isCurrentlyInSegment && (
                          <Badge variant="secondary" className="text-xs">
                            Already added
                          </Badge>
                        )}
                      </div>
                      {segment.description && (
                        <p className="text-sm text-muted-foreground">
                          {segment.description}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {segment.count_cached} customers
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddToSegments}
              disabled={addToSegmentsMutation.isPending || selectedSegments.length === 0}
            >
              {addToSegmentsMutation.isPending ? (
                <>Adding...</>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Add to {selectedSegments.length} Segment{selectedSegments.length !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};