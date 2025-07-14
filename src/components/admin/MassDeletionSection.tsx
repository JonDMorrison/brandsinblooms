
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Users } from "lucide-react";
import { SUPER_ADMIN_EMAILS } from "@/utils/adminUtils";
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
// Removed sonner import - using global toast replacement
import { useState } from "react";

interface AdminUserData {
  id: string;
  email: string;
}

interface MassDeletionSectionProps {
  nonAdminUsers: AdminUserData[];
  onMassDelete: (users: AdminUserData[]) => Promise<void>;
}

export const MassDeletionSection = ({ nonAdminUsers, onMassDelete }: MassDeletionSectionProps) => {
  const [confirmationText, setConfirmationText] = useState("");

  const handleMassDeletion = async () => {
    if (confirmationText !== "DELETE ALL") {
      toast.error('Please type "DELETE ALL" to confirm mass deletion');
      return;
    }

    console.log(`[MassDeletion] Starting deletion of ${nonAdminUsers.length} non-admin users`);
    
    let deletedCount = 0;
    let failedCount = 0;

    // Show initial progress
    toast.loading(`Deleting ${nonAdminUsers.length} users...`, {
      id: 'mass-deletion'
    });

    for (const user of nonAdminUsers) {
      try {
        console.log(`[MassDeletion] Deleting user: ${user.email}`);
        await onMassDelete([user]);
        deletedCount++;
        console.log(`[MassDeletion] Successfully deleted: ${user.email}`);
      } catch (error) {
        failedCount++;
        console.error(`[MassDeletion] Error deleting ${user.email}:`, error);
      }
    }

    // Clear the toast and show results
    toast.dismiss('mass-deletion');
    
    if (deletedCount > 0 && failedCount === 0) {
      toast.success(`🎉 Successfully deleted all ${deletedCount} non-admin users! Database reset complete.`);
    } else if (deletedCount > 0 && failedCount > 0) {
      toast.warning(`Deleted ${deletedCount} users, but ${failedCount} failed. Check console for details.`);
    } else {
      toast.error(`Failed to delete ${failedCount} users. Check console for details.`);
    }

    console.log(`[MassDeletion] Mass deletion completed. Success: ${deletedCount}, Failed: ${failedCount}`);
    setConfirmationText(""); // Reset confirmation text
  };

  return (
    <Card className="border-red-200 bg-red-50">
      <CardHeader>
        <CardTitle className="text-red-800 flex items-center gap-2">
          <Trash2 className="w-5 h-5" />
          Database Reset
        </CardTitle>
        <CardDescription className="text-red-700">
          Delete all user accounts except Master Admin accounts ({SUPER_ADMIN_EMAILS.join(', ')})
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-red-700">
              <Users className="w-4 h-4" />
              <span>{nonAdminUsers.length} non-admin users will be deleted</span>
            </div>
            <div className="text-xs text-red-600">
              This will permanently delete all user data including profiles, content, campaigns, and subscriptions
            </div>
          </div>
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="destructive" 
                disabled={nonAdminUsers.length === 0}
                className="gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete All Non-Admin Users
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="max-w-md">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-red-800">
                  ⚠️ MASS DELETION WARNING
                </AlertDialogTitle>
                <AlertDialogDescription className="space-y-3">
                  <div className="p-3 bg-red-100 rounded text-red-800 text-sm">
                    <strong>You are about to permanently delete {nonAdminUsers.length} user accounts</strong>
                  </div>
                  
                  <div className="text-sm">
                    <strong>Protected accounts (will NOT be deleted):</strong>
                    <ul className="mt-1 list-disc list-inside text-green-700">
                      {SUPER_ADMIN_EMAILS.map(email => (
                        <li key={email}>{email}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-3 bg-gray-100 rounded text-gray-800 text-sm">
                    <strong>This will delete ALL:</strong>
                    <ul className="mt-1 list-disc list-inside">
                      <li>User profiles and company data</li>
                      <li>Content tasks and campaigns</li>
                      <li>Subscriptions and billing data</li>
                      <li>Social connections and analytics</li>
                    </ul>
                  </div>

                  <div className="mt-4">
                    <label className="text-sm font-medium">
                      Type "DELETE ALL" to confirm:
                    </label>
                    <Input
                      value={confirmationText}
                      onChange={(e) => setConfirmationText(e.target.value)}
                      placeholder="DELETE ALL"
                      className="mt-1"
                    />
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setConfirmationText("")}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleMassDeletion}
                  disabled={confirmationText !== "DELETE ALL"}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Delete {nonAdminUsers.length} Users Permanently
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
};
