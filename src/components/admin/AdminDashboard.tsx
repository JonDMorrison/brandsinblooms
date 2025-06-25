
import { RevenueSection } from "./RevenueSection";  
import { MassDeletionSection } from "./MassDeletionSection";
import { AdminUsersSection } from "./AdminUsersSection";
import { useAdminData } from "@/hooks/useAdminData";
import { useAdminUsers } from "@/hooks/useAdminUsers";
import { useState } from "react";
import { SUPER_ADMIN_EMAILS } from "@/utils/adminUtils";

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

  // Get non-admin users for mass deletion
  const nonAdminUsers = detailedUsers.filter(user => 
    !SUPER_ADMIN_EMAILS.includes(user.email)
  );

  const handleMassDeletion = async (users: Array<{ id: string; email: string }>) => {
    for (const user of users) {
      await deleteUser(user.id);
    }
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
      {/* Revenue Section */}
      <RevenueSection metrics={metrics} />

      {/* Mass Deletion Section */}
      <MassDeletionSection 
        nonAdminUsers={nonAdminUsers}
        onMassDelete={handleMassDeletion}
      />

      {/* Users Section */}
      <AdminUsersSection
        users={detailedUsers}
        filteredUsers={filteredUsers}
        searchTerm={searchTerm}
        onSearch={setSearchTerm}
        onDeleteUser={deleteUser}
        loading={usersLoading}
      />
    </div>
  );
};
