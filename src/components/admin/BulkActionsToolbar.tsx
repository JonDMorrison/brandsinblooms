
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Trash2, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import { SUPER_ADMIN_EMAILS } from "@/utils/adminUtils";

interface AdminUserData {
  id: string;
  email: string;
  is_duplicate?: boolean;
  account_number?: number;
}

interface BulkActionsToolbarProps {
  selectedUserIds: Set<string>;
  users: AdminUserData[];
  onBulkDelete: (users: Array<{id: string, email: string}>) => Promise<void>;
  onClearSelection: () => void;
  isProcessing: boolean;
  progress: {
    total: number;
    completed: number;
    failed: number;
  };
}

export const BulkActionsToolbar = ({
  selectedUserIds,
  users,
  onBulkDelete,
  onClearSelection,
  isProcessing,
  progress
}: BulkActionsToolbarProps) => {
  // Filter out admin users from selection
  const selectedUsers = users.filter(user => 
    selectedUserIds.has(user.id) && !SUPER_ADMIN_EMAILS.includes(user.email)
  );
  const selectedCount = selectedUsers.length;

  // Check if any admin users were selected (for warning)
  const selectedAdminUsers = users.filter(user => 
    selectedUserIds.has(user.id) && SUPER_ADMIN_EMAILS.includes(user.email)
  );

  if (selectedCount === 0 && !isProcessing && selectedAdminUsers.length === 0) {
    return null;
  }

  const handleBulkDelete = () => {
    onBulkDelete(selectedUsers.map(user => ({ id: user.id, email: user.email })));
  };

  const duplicateCount = selectedUsers.filter(user => user.is_duplicate).length;

  return (
    <Card className="p-4 mb-4 bg-blue-50 border-blue-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="text-sm font-medium">
            {isProcessing ? (
              <span>Processing bulk deletion...</span>
            ) : (
              <span>{selectedCount} user{selectedCount !== 1 ? 's' : ''} selected</span>
            )}
          </div>

          {selectedAdminUsers.length > 0 && !isProcessing && (
            <div className="text-xs text-orange-600 bg-orange-100 px-2 py-1 rounded">
              {selectedAdminUsers.length} admin user{selectedAdminUsers.length !== 1 ? 's' : ''} excluded from deletion
            </div>
          )}
          
          {duplicateCount > 0 && !isProcessing && (
            <div className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
              {duplicateCount} duplicate account{duplicateCount !== 1 ? 's' : ''}
            </div>
          )}

          {isProcessing && (
            <div className="flex items-center gap-2">
              <Progress value={(progress.completed / progress.total) * 100} className="w-32" />
              <span className="text-xs text-gray-600">
                {progress.completed}/{progress.total} completed
                {progress.failed > 0 && `, ${progress.failed} failed`}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!isProcessing && selectedCount > 0 && (
            <>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="gap-2">
                    <Trash2 className="w-4 h-4" />
                    Delete Selected
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete {selectedCount} User{selectedCount !== 1 ? 's' : ''}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      You are about to permanently delete {selectedCount} user account{selectedCount !== 1 ? 's' : ''}:
                      
                      <div className="mt-3 max-h-32 overflow-y-auto bg-gray-50 p-2 rounded text-sm">
                        {selectedUsers.map(user => (
                          <div key={user.id} className="flex items-center justify-between py-1">
                            <span>{user.email}</span>
                            {user.is_duplicate && (
                              <span className="text-xs text-gray-500">
                                Account #{user.account_number}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>

                      {selectedAdminUsers.length > 0 && (
                        <div className="mt-3 p-2 bg-green-50 rounded text-green-800 text-sm">
                          <strong>Protected:</strong> {selectedAdminUsers.length} admin account{selectedAdminUsers.length !== 1 ? 's' : ''} will NOT be deleted:
                          <ul className="mt-1 list-disc list-inside">
                            {selectedAdminUsers.map(user => (
                              <li key={user.id}>{user.email}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="mt-3 p-2 bg-red-50 rounded text-red-800 text-sm">
                        <strong>Warning:</strong> This will permanently delete all their data including campaigns, content, and subscriptions.  This action cannot be undone.
                      </div>

                      {duplicateCount > 0 && (
                        <div className="mt-2 p-2 bg-gray-50 rounded text-gray-800 text-sm">
                          <strong>Note:</strong> {duplicateCount} of these users have duplicate accounts.  Consider using the Duplicate Management section to merge accounts instead.
                        </div>
                      )}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleBulkDelete}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      Delete {selectedCount} User{selectedCount !== 1 ? 's' : ''}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <Button variant="outline" size="sm" onClick={onClearSelection}>
                <X className="w-4 h-4 mr-1" />
                Clear
              </Button>
            </>
          )}

          {selectedAdminUsers.length > 0 && selectedCount === 0 && !isProcessing && (
            <Button variant="outline" size="sm" onClick={onClearSelection}>
              <X className="w-4 h-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};
