
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RevenueSection } from "./RevenueSection";  
import { EnhancedUserTable } from "./EnhancedUserTable";
import { UserSearch } from "./UserSearch";
import { useAdminData } from "@/hooks/useAdminData";
import { useAdminUsers } from "@/hooks/useAdminUsers";
import { useState } from "react";

export const AdminDashboard = () => {
  const { metrics, loading: metricsLoading } = useAdminData();
  const { users: detailedUsers, loading: usersLoading, deleteUser } = useAdminUsers();
  const [searchTerm, setSearchTerm] = useState("");

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
          <h1 className="text-3xl font-bold text-garden-green-dark">Admin Dashboard</h1>
          <p className="text-garden-green font-medium">Real platform metrics and user management</p>
        </div>
      </div>

      {/* Revenue Section */}
      <RevenueSection metrics={metrics} />

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
            </div>
          </div>
          <UserSearch 
            onSearch={setSearchTerm}
            placeholder="Search by email or company name..."
          />
        </div>

        {/* Duplicate accounts warning */}
        {duplicateUsers.length > 0 && (
          <Card className="border-gray-200 bg-gray-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-gray-800 text-lg flex items-center gap-2">
                <span>⚠️</span>
                Duplicate Accounts Detected
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 text-sm">
                Found {duplicateUsers.length} duplicate accounts across {detailedUsers.length - uniqueEmails} users. 
                These accounts are highlighted in grey below.
              </p>
            </CardContent>
          </Card>
        )}

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
