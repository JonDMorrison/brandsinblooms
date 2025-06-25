
import { EnhancedUserTable } from "./EnhancedUserTable";
import { UserSearch } from "./UserSearch";
import { Card, CardContent } from "@/components/ui/card";
import { SUPER_ADMIN_EMAILS } from "@/utils/adminUtils";

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

interface AdminUsersSectionProps {
  users: AdminUserData[];
  filteredUsers: AdminUserData[];
  searchTerm: string;
  onSearch: (term: string) => void;
  onDeleteUser: (userId: string) => Promise<boolean>;
  loading: boolean;
}

export const AdminUsersSection = ({ 
  users, 
  filteredUsers, 
  searchTerm, 
  onSearch, 
  onDeleteUser, 
  loading 
}: AdminUsersSectionProps) => {
  // Calculate duplicate statistics
  const duplicateUsers = users.filter(user => user.is_duplicate);
  const uniqueEmails = new Set(users.map(user => user.email)).size;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-garden-green-dark">
            All Users ({filteredUsers.length} of {users.length})
          </h2>
          <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
            <span>Unique emails: {uniqueEmails}</span>
            <span>Duplicate accounts: {duplicateUsers.length}</span>
            <span>Total accounts: {users.length}</span>
            <span className="text-green-600 font-medium">Protected admins: {SUPER_ADMIN_EMAILS.length}</span>
          </div>
        </div>
        <UserSearch 
          onSearch={onSearch}
          placeholder="Search by email or company name..."
        />
      </div>

      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </CardContent>
        </Card>
      ) : (
        <EnhancedUserTable users={filteredUsers} onDeleteUser={onDeleteUser} />
      )}
    </div>
  );
};
