import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MoreHorizontal, Mail, Calendar, Coins, Trash2, AlertTriangle, Merge } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useState } from "react";
import { toast } from "sonner";
import { isSuperAdmin } from "@/utils/adminUtils";
import { useAuth } from "@/contexts/AuthContext";

interface AdminUserData {
  id: string;
  email: string;
  created_at: string;
  company_name?: string;
  company_overview?: string;
  location_info?: string;
  plan: string;
  status: string;
  trial_end_date?: string;
  last_login?: string;
  tokens_balance?: number;
  onboarding_completed?: boolean;
  is_duplicate?: boolean;
  account_number?: number;
}

interface EnhancedUserTableProps {
  users: AdminUserData[];
  onDeleteUser: (userId: string) => Promise<boolean>;
}

export const EnhancedUserTable = ({ users, onDeleteUser }: EnhancedUserTableProps) => {
  const [deletingUser, setDeletingUser] = useState<string | null>(null);
  const { user } = useAuth();

  const getPlanBadgeColor = (plan: string) => {
    switch (plan) {
      case 'bloom': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'sprout': return 'bg-green-100 text-green-800 border-green-200';
      case 'free_trial': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    return status === 'active' 
      ? 'bg-green-100 text-green-800 border-green-200' 
      : 'bg-red-100 text-red-800 border-red-200';
  };

  const getInitials = (email: string, companyName?: string) => {
    if (companyName && companyName !== 'Not set') {
      return companyName.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString();
  };

  const getDaysRemaining = (endDate?: string) => {
    if (!endDate) return null;
    const days = Math.ceil((new Date(endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    return days;
  };

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    console.log(`[EnhancedUserTable] Starting deletion process for user: ${userId} (${userEmail})`);
    
    // Check if current user is super admin
    if (!user?.email || !isSuperAdmin(user.email)) {
      console.error(`[EnhancedUserTable] Access denied: Current user ${user?.email} is not a super admin`);
      toast.error('Access denied. Only super administrators can delete users.');
      return;
    }

    console.log(`[EnhancedUserTable] Super admin check passed for: ${user.email}`);

    if (deletingUser) {
      console.log(`[EnhancedUserTable] Another deletion in progress, ignoring request`);
      toast.warning('Another deletion is already in progress. Please wait.');
      return;
    }

    setDeletingUser(userId);
    console.log(`[EnhancedUserTable] Set deleting state for user: ${userId}`);

    try {
      console.log(`[EnhancedUserTable] Calling onDeleteUser function...`);
      const success = await onDeleteUser(userId);
      
      console.log(`[EnhancedUserTable] Delete operation result: ${success}`);
      
      if (success) {
        toast.success(`User ${userEmail} has been successfully deleted.`);
        console.log(`[EnhancedUserTable] Successfully deleted user: ${userEmail}`);
      } else {
        toast.error(`Failed to delete user ${userEmail}. Please check the console for details.`);
        console.error(`[EnhancedUserTable] Delete operation returned false for user: ${userEmail}`);
      }
    } catch (error) {
      console.error(`[EnhancedUserTable] Error during deletion:`, error);
      
      // Provide specific error messages based on error type
      if (error instanceof Error) {
        if (error.message.includes('Access denied')) {
          toast.error('Access denied. Only super administrators can delete users.');
        } else if (error.message.includes('Network')) {
          toast.error('Network error. Please check your connection and try again.');
        } else {
          toast.error(`Failed to delete user: ${error.message}`);
        }
      } else {
        toast.error('An unexpected error occurred while deleting the user.');
      }
    } finally {
      setDeletingUser(null);
      console.log(`[EnhancedUserTable] Cleared deleting state for user: ${userId}`);
    }
  };

  return (
    <Card className="rounded-xl">
      <CardHeader>
        <CardTitle className="text-xl">All Users ({users.length})</CardTitle>
        <p className="text-sm text-gray-600">
          Showing all accounts including duplicates. Users with multiple accounts are marked. Use the Duplicate Management section above to merge accounts safely.
        </p>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Plan & Status</TableHead>
              <TableHead>Trial Info</TableHead>
              <TableHead>Tokens</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const daysRemaining = getDaysRemaining(user.trial_end_date);
              const isDeleting = deletingUser === user.id;
              
              return (
                <TableRow key={user.id} className={user.is_duplicate ? 'bg-gray-50' : ''}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">
                          {getInitials(user.email, user.company_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="font-medium">{user.email}</div>
                          {user.is_duplicate && (
                            <div className="flex items-center gap-1">
                              <AlertTriangle className="w-4 h-4 text-gray-500" />
                              <Badge variant="outline" className="text-xs bg-gray-100 text-gray-800">
                                Account #{user.account_number}
                              </Badge>
                            </div>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">
                          Joined {formatDate(user.created_at)}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div>
                      <div className="font-medium">
                        {user.company_name || 'Not set'}
                      </div>
                      <Badge variant="outline" className="mt-1">
                        {user.onboarding_completed ? 'Onboarded' : 'Pending'}
                      </Badge>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div className="space-y-1">
                      <Badge className={getPlanBadgeColor(user.plan)}>
                        {user.plan.replace('_', ' ').charAt(0).toUpperCase() + user.plan.slice(1)}
                      </Badge>
                      <Badge className={getStatusBadgeColor(user.status)}>
                        {user.status}
                      </Badge>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    {user.plan === 'free_trial' && user.trial_end_date && (
                      <div className="text-sm">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Ends {formatDate(user.trial_end_date)}
                        </div>
                        {daysRemaining !== null && (
                          <div className={`text-xs ${daysRemaining <= 3 ? 'text-red-600' : 'text-gray-600'}`}>
                            {daysRemaining > 0 ? `${daysRemaining} days left` : 'Expired'}
                          </div>
                        )}
                      </div>
                    )}
                  </TableCell>
                  
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Coins className="w-4 h-4 text-orange-600" />
                      <span className={user.tokens_balance && user.tokens_balance < 0 ? 'text-red-600' : ''}>
                        {user.tokens_balance || 0}
                      </span>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div className="text-sm text-gray-600">
                      {formatDate(user.last_login)}
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0" disabled={isDeleting}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Mail className="mr-2 h-4 w-4" />
                          Send Email
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          View Profile
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          Reset Password
                        </DropdownMenuItem>
                        {user.is_duplicate && (
                          <DropdownMenuItem className="text-blue-600">
                            <Merge className="mr-2 h-4 w-4" />
                            Manage Duplicates
                          </DropdownMenuItem>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()} disabled={isDeleting}>
                              <Trash2 className="mr-2 h-4 w-4 text-red-600" />
                              <span className="text-red-600">
                                {isDeleting ? 'Deleting...' : 'Delete User'}
                              </span>
                            </DropdownMenuItem>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete User Account</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to permanently delete the account for <strong>{user.email}</strong>
                                {user.is_duplicate && ` (Account #${user.account_number})`}? 
                                This will delete all their data including campaigns, content, and subscriptions. 
                                This action cannot be undone.
                                {user.is_duplicate && (
                                  <div className="mt-2 p-2 bg-gray-50 rounded text-gray-800 text-sm">
                                    <strong>Note:</strong> This user has multiple accounts. Consider using the Duplicate Management section to merge accounts instead of deleting.
                                  </div>
                                )}
                                <div className="mt-2 p-2 bg-blue-50 rounded text-blue-800 text-sm">
                                  <strong>Admin Check:</strong> Only super administrators can delete users. 
                                  Current user: {user?.email || 'Not logged in'} 
                                  {user?.email && isSuperAdmin(user.email) ? ' ✓ (Super Admin)' : ' ✗ (Not Super Admin)'}
                                </div>
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteUser(user.id, user.email)}
                                disabled={isDeleting || !user?.email || !isSuperAdmin(user.email)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                {isDeleting ? 'Deleting...' : 'Delete User'}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
