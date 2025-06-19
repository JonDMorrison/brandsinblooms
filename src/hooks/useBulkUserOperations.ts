
import { useState } from "react";
import { toast } from "sonner";

interface BulkOperationState {
  selectedUserIds: Set<string>;
  isProcessing: boolean;
  progress: {
    total: number;
    completed: number;
    failed: number;
  };
}

export const useBulkUserOperations = (onDeleteUser: (userId: string) => Promise<boolean>) => {
  const [state, setState] = useState<BulkOperationState>({
    selectedUserIds: new Set(),
    isProcessing: false,
    progress: { total: 0, completed: 0, failed: 0 }
  });

  const toggleUserSelection = (userId: string) => {
    setState(prev => {
      const newSelection = new Set(prev.selectedUserIds);
      if (newSelection.has(userId)) {
        newSelection.delete(userId);
      } else {
        newSelection.add(userId);
      }
      return { ...prev, selectedUserIds: newSelection };
    });
  };

  const selectAll = (userIds: string[]) => {
    setState(prev => ({
      ...prev,
      selectedUserIds: new Set(userIds)
    }));
  };

  const clearSelection = () => {
    setState(prev => ({
      ...prev,
      selectedUserIds: new Set()
    }));
  };

  const bulkDeleteUsers = async (users: Array<{id: string, email: string}>) => {
    const selectedUsers = users.filter(user => state.selectedUserIds.has(user.id));
    
    if (selectedUsers.length === 0) {
      toast.error('No users selected for deletion');
      return;
    }

    setState(prev => ({
      ...prev,
      isProcessing: true,
      progress: { total: selectedUsers.length, completed: 0, failed: 0 }
    }));

    console.log(`[BulkDelete] Starting bulk deletion of ${selectedUsers.length} users`);

    let completed = 0;
    let failed = 0;

    for (const user of selectedUsers) {
      try {
        console.log(`[BulkDelete] Deleting user: ${user.email}`);
        const success = await onDeleteUser(user.id);
        
        if (success) {
          completed++;
          console.log(`[BulkDelete] Successfully deleted: ${user.email}`);
        } else {
          failed++;
          console.error(`[BulkDelete] Failed to delete: ${user.email}`);
        }
      } catch (error) {
        failed++;
        console.error(`[BulkDelete] Error deleting ${user.email}:`, error);
      }

      setState(prev => ({
        ...prev,
        progress: { ...prev.progress, completed: completed, failed: failed }
      }));
    }

    setState(prev => ({
      ...prev,
      isProcessing: false,
      selectedUserIds: new Set()
    }));

    // Show results
    if (completed > 0 && failed === 0) {
      toast.success(`Successfully deleted ${completed} user${completed > 1 ? 's' : ''}`);
    } else if (completed > 0 && failed > 0) {
      toast.warning(`Deleted ${completed} users, but ${failed} failed. Check console for details.`);
    } else {
      toast.error(`Failed to delete ${failed} user${failed > 1 ? 's' : ''}. Check console for details.`);
    }

    console.log(`[BulkDelete] Bulk deletion completed. Success: ${completed}, Failed: ${failed}`);
  };

  return {
    selectedUserIds: state.selectedUserIds,
    isProcessing: state.isProcessing,
    progress: state.progress,
    toggleUserSelection,
    selectAll,
    clearSelection,
    bulkDeleteUsers
  };
};
