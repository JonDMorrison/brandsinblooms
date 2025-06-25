
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RevenueSection } from "./RevenueSection";  
import { EnhancedUserTable } from "./EnhancedUserTable";
import { UserSearch } from "./UserSearch";
import { useAdminData } from "@/hooks/useAdminData";
import { useAdminUsers } from "@/hooks/useAdminUsers";
import { useState } from "react";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export const AdminDashboard = () => {
  const { metrics, loading: metricsLoading } = useAdminData();
  const { users: detailedUsers, loading: usersLoading, deleteUser } = useAdminUsers();
  const [searchTerm, setSearchTerm] = useState("");
  const [confirmationText, setConfirmationText] = useState("");

  console.log("Admin Dashboard - Metrics:", metrics);
  console.log("Admin Dashboard - Users count:", detailedUsers.length);

  // Filter users based on search term
  const filteredUsers = detailedUsers.filter(user => 
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.company_name && user.company_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Calculate duplicate statistics
  const duplicateUsers = detailedUsers.filter(user => user.is_duplicate);
  const uniqueEmails = new Set(detailedUsers.map(user => user.email)).size;

  // Get non-admin users for mass deletion
  const nonAdminUsers = detailedUsers.filter(user => 
    !SUPER_ADMIN_EMAILS.includes(user.email)
  );

  const handleMassDeletion = async () => {
    if (confirmationText !== "DELETE ALL") {
      toast.error('Please type "DELETE ALL" to confirm mass deletion');
      return;
    }

    const nonAdminUserData = nonAdminUsers.map(user => ({ 
      id: user.id, 
      email: user.email 
    }));

    console.log(`[MassDeletion] Starting deletion of ${nonAdminUserData.length} non-admin users`);
    
    let deletedCount = 0;
    let failedCount = 0;

    // Show initial progress
    toast.loading(`Deleting ${nonAdminUserData.length} users...`, {
      id: 'mass-deletion'
    });

    for (const user of nonAdminUserData) {
      try {
        console.log(`[MassDeletion] Deleting user: ${user.email}`);
        const success = await deleteUser(user.id);
        
        if (success) {
          deletedCount++;
          console.log(`[MassDeletion] Successfully deleted: ${user.email}`);
        } else {
          failedCount++;
          console.error(`[MassDeletion] Failed to delete: ${user.email}`);
        }
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

  if (metricsLoading && usersLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
        </div>
      </div>

      {/* Revenue Section */}
      <RevenueSection metrics={metrics} />

      {/* Mass Deletion Section */}
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

      {/* Users Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-garden-green-dark">
              All Users ({filteredUsers.length} of {detailedUsers.length})
            </h2>
            <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
              <span>Unique emails: {uniqueEmails}</span>
              <span>Duplicate accounts: {duplicateUsers.length}</span>
              <span>Total accounts: {detailedUsers.length}</span>
              <span className="text-green-600 font-medium">Protected admins: {SUPER_ADMIN_EMAILS.length}</span>
            </div>
          </div>
          <UserSearch 
            onSearch={setSearchTerm}
            placeholder="Search by email or company name..."
          />
        </div>

        {usersLoading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </CardContent>
          </Card>
        ) : (
          <EnhancedUserTable users={filteredUsers} onDeleteUser={deleteUser} />
        )}
      </div>
    </div>
  );
};
