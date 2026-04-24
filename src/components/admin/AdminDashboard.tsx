import { RevenueSection } from "./RevenueSection";
import { MassDeletionSection } from "./MassDeletionSection";
import { AdminUsersSection } from "./AdminUsersSection";
import CircularProgress from "@mui/joy/CircularProgress";
import Stack from "@mui/joy/Stack";
import { useAdminData } from "@/hooks/useAdminData";
import { useAdminUsers } from "@/hooks/useAdminUsers";
import { useState } from "react";
import { SUPER_ADMIN_EMAILS } from "@/utils/adminUtils";

export const AdminDashboard = () => {
  const { metrics, loading: metricsLoading } = useAdminData();
  const {
    users: detailedUsers,
    loading: usersLoading,
    deleteUser,
  } = useAdminUsers();
  const [searchTerm, setSearchTerm] = useState("");

  // Admin Dashboard - Metrics
  // Admin Dashboard - Users count

  // Filter users based on search term
  const filteredUsers = detailedUsers.filter(
    (user) =>
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.company_name &&
        user.company_name.toLowerCase().includes(searchTerm.toLowerCase())),
  );

  // Get non-admin users for mass deletion
  const nonAdminUsers = detailedUsers.filter(
    (user) => !SUPER_ADMIN_EMAILS.includes(user.email),
  );

  const handleMassDeletion = async (
    users: Array<{ id: string; email: string }>,
  ) => {
    for (const user of users) {
      await deleteUser(user.id);
    }
  };

  if (metricsLoading && usersLoading) {
    return (
      <Stack spacing={3}>
        <Stack alignItems="center" justifyContent="center" minHeight={160}>
          <CircularProgress size="md" />
        </Stack>
      </Stack>
    );
  }

  return (
    <Stack spacing={4}>
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
    </Stack>
  );
};
