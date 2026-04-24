import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoySearchInput } from "@/components/joy/JoySearchInput";
import { UserManagementTable } from "./UserManagementTable";
import { EmptyState } from "@/components/ui-legacy/empty-state";
import { Users } from "lucide-react";
import { useState } from "react";

interface UserData {
  id: string;
  email: string;
  created_at: string;
  plan: string;
  status: string;
  campaignCount: number;
  taskCount: number;
}

interface UserManagementSectionProps {
  users: UserData[];
}

export const UserManagementSection = ({
  users,
}: UserManagementSectionProps) => {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredUsers = users.filter((user) =>
    user.email.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <Stack spacing={2}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        spacing={2}
      >
        <Typography
          level="title-lg"
          sx={{ color: "var(--joy-palette-brandNavy-800)" }}
        >
          Basic User Overview
        </Typography>
        <JoyButton
          color="success"
          variant="solid"
          sx={{ borderRadius: "var(--joy-radius-xl)" }}
        >
          Invite User
        </JoyButton>
      </Stack>

      <JoyCard>
        <JoyCardHeader
          title={`Quick User Stats (${users.length})`}
          actions={
            <JoySearchInput
              placeholder="Search users..."
              value={searchTerm}
              onValueChange={setSearchTerm}
              sx={{ width: 256 }}
            />
          }
        />
        <JoyCardContent>
          {users.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No users yet"
              description="Invite your first user or verify your Stripe setup."
              action={{
                label: "Invite User",
                onClick: () => {},
              }}
            />
          ) : (
            <UserManagementTable users={filteredUsers} />
          )}
        </JoyCardContent>
      </JoyCard>
    </Stack>
  );
};
