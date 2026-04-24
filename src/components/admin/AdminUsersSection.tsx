import { EnhancedUserTable } from "./EnhancedUserTable";
import { UserSearch } from "./UserSearch";
import CircularProgress from "@mui/joy/CircularProgress";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { JoyCard, JoyCardContent } from "@/components/joy/JoyCard";
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
  loading,
}: AdminUsersSectionProps) => {
  // Calculate duplicate statistics
  const duplicateUsers = users.filter((user) => user.is_duplicate);
  const uniqueEmails = new Set(users.map((user) => user.email)).size;

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: "column", lg: "row" }}
        alignItems={{ xs: "flex-start", lg: "center" }}
        justifyContent="space-between"
        spacing={2}
      >
        <Stack spacing={0.5}>
          <Typography
            level="title-lg"
            sx={{ color: "var(--joy-palette-brandNavy-800)" }}
          >
            All Users ({filteredUsers.length} of {users.length})
          </Typography>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <Typography level="body-sm" color="neutral">
              Unique emails: {uniqueEmails}
            </Typography>
            <Typography level="body-sm" color="neutral">
              Duplicate accounts: {duplicateUsers.length}
            </Typography>
            <Typography level="body-sm" color="neutral">
              Total accounts: {users.length}
            </Typography>
            <Typography level="body-sm" color="success" fontWeight="lg">
              Protected admins: {SUPER_ADMIN_EMAILS.length}
            </Typography>
          </Stack>
        </Stack>
        <UserSearch
          onSearch={onSearch}
          placeholder="Search by email or company name..."
        />
      </Stack>

      {loading ? (
        <JoyCard>
          <JoyCardContent sx={{ pt: 3 }}>
            <Stack alignItems="center" justifyContent="center" minHeight={160}>
              <CircularProgress size="md" />
            </Stack>
          </JoyCardContent>
        </JoyCard>
      ) : (
        <EnhancedUserTable users={filteredUsers} onDeleteUser={onDeleteUser} />
      )}
    </Stack>
  );
};
