
import { useState } from "react";
// Removed sonner import - using global toast replacement

interface BulkProgress {
  total: number;
  completed: number;
  failed: number;
}

export const useBulkUserOperations = (onDeleteUser: (userId: string) => Promise<boolean>) => {
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<BulkProgress>({ total: 0, completed: 0, failed: 0 });

  const toggleUserSelection = (userId: string) => {
    const newSelection = new Set(selectedUserIds);
    if (newSelection.has(userId)) {
      newSelection.delete(userId);
    } else {
      newSelection.add(userId);
    }
    setSelectedUserIds(newSelection);
  };

  const selectAll = (userIds: string[]) => {
    setSelectedUserIds(new Set(userIds));
  };

  const clearSelection = () => {
    setSelectedUserIds(new Set());
  };

  const bulkDeleteUsers = async (users: Array<{id: string, email: string}>) => {
    if (users.length === 0) return;

    setIsProcessing(true);
    setProgress({ total: users.length, completed: 0, failed: 0 });

    console.log(`[BulkOperations] Starting bulk deletion of ${users.length} users`);

    let completed = 0;
    let failed = 0;

    // Show initial progress toast
    toast.loading(`Deleting ${users.length} users...`, { id: 'bulk-delete' });

    for (const user of users) {
      try {
        console.log(`[BulkOperations] Deleting user: ${user.email}`);
        const success = await onDeleteUser(user.id);
        
        if (success) {
          completed++;
          console.log(`[BulkOperations] Successfully deleted: ${user.email}`);
        } else {
          failed++;
          console.error(`[BulkOperations] Failed to delete: ${user.email}`);
        }
      } catch (error) {
        failed++;
        console.error(`[BulkOperations] Error deleting ${user.email}:`, error);
      }

      // Update progress
      setProgress({ total: users.length, completed, failed });
    }

    // Clear progress toast and show results
    toast.dismiss('bulk-delete');
    
    if (completed > 0 && failed === 0) {
      toast.success(`✅ Successfully deleted all ${completed} users!`);
    } else if (completed > 0 && failed > 0) {
      toast.warning(`⚠️ Deleted ${completed} users, but ${failed} failed. Check console for details.`);
    } else {
      toast.error(`❌ Failed to delete ${failed} users. Check console for details.`);
    }

    console.log(`[BulkOperations] Bulk deletion completed. Success: ${completed}, Failed: ${failed}`);
    
    // Clear selection and reset state
    clearSelection();
    setIsProcessing(false);
    setProgress({ total: 0, completed: 0, failed: 0 });
  };

  return {
    selectedUserIds,
    isProcessing,
    progress,
    toggleUserSelection,
    selectAll,
    clearSelection,
    bulkDeleteUsers
  };
};
