import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface BulkProgress {
  total: number;
  completed: number;
  failed: number;
}

export const useBulkCustomerOperations = () => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<BulkProgress>({ total: 0, completed: 0, failed: 0 });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const toggleSelection = (customerId: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(customerId)) {
        newSet.delete(customerId);
      } else {
        newSet.add(customerId);
      }
      return newSet;
    });
  };

  const selectAll = (customerIds: string[]) => {
    setSelectedIds(new Set(customerIds));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const bulkDeleteCustomers = async (customerIds: string[]) => {
    if (customerIds.length === 0) return;

    setIsProcessing(true);
    setProgress({ total: customerIds.length, completed: 0, failed: 0 });

    let completed = 0;
    let failed = 0;

    for (const customerId of customerIds) {
      try {
        const { error } = await supabase
          .from('crm_customers')
          .delete()
          .eq('id', customerId);

        if (error) {
          failed++;
          console.error(`Failed to delete customer ${customerId}:`, error);
        } else {
          completed++;
        }
      } catch (error) {
        failed++;
        console.error(`Error deleting customer ${customerId}:`, error);
      }

      setProgress({ total: customerIds.length, completed, failed });
    }

    // Invalidate queries
    queryClient.invalidateQueries({ queryKey: ['customers'] });
    queryClient.invalidateQueries({ queryKey: ['crm-customers'] });

    // Show results
    if (completed > 0 && failed === 0) {
      toast({
        title: "Customers deleted",
        description: `Successfully deleted ${completed} customer(s).`,
      });
    } else if (completed > 0 && failed > 0) {
      toast({
        title: "Partial success",
        description: `Deleted ${completed} customer(s), but ${failed} failed.`,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Deletion failed",
        description: `Failed to delete ${failed} customer(s).`,
        variant: "destructive",
      });
    }

    clearSelection();
    setIsProcessing(false);
    setProgress({ total: 0, completed: 0, failed: 0 });
  };

  return {
    selectedIds,
    isProcessing,
    progress,
    toggleSelection,
    selectAll,
    clearSelection,
    bulkDeleteCustomers,
  };
};
