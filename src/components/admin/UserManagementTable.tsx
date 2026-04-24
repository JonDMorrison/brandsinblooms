import Chip from "@mui/joy/Chip";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  JoyTable,
  JoyTableBody,
  JoyTableCell,
  JoyTableHead,
  JoyTableHeaderCell,
  JoyTableRow,
} from "@/components/joy/JoyTable";

interface UserData {
  id: string;
  email: string;
  created_at: string;
  plan: string;
  status: string;
  campaignCount: number;
  taskCount: number;
}

interface UserManagementTableProps {
  users: UserData[];
}

export const UserManagementTable = ({ users }: UserManagementTableProps) => {
  const getPlanChip = (plan: string) => {
    switch (plan) {
      case "bloom":
        return { color: "primary", label: "Bloom" };
      case "sprout":
        return { color: "success", label: "Sprout" };
      case "free_trial":
        return { color: "info", label: "Free Trial" };
      default:
        return {
          color: "neutral",
          label: plan.charAt(0).toUpperCase() + plan.slice(1),
        };
    }
  };

  const getStatusChip = (status: string) => {
    return status === "Active"
      ? { color: "success", label: status }
      : { color: "danger", label: status };
  };

  if (users.length === 0) {
    return (
      <Stack
        spacing={0.75}
        alignItems="center"
        justifyContent="center"
        sx={{ py: 6, color: "neutral.500" }}
      >
        <Typography level="title-sm">No users found</Typography>
        <Typography level="body-sm" color="neutral" textAlign="center">
          Adjust the current filters or refresh the data source.
        </Typography>
      </Stack>
    );
  }

  return (
    <JoyTable containerSx={{ minWidth: 720 }}>
      <JoyTableHead>
        <JoyTableRow>
          <JoyTableHeaderCell>Email</JoyTableHeaderCell>
          <JoyTableHeaderCell>Plan</JoyTableHeaderCell>
          <JoyTableHeaderCell>Status</JoyTableHeaderCell>
          <JoyTableHeaderCell align="right">Campaigns</JoyTableHeaderCell>
          <JoyTableHeaderCell align="right">Content Tasks</JoyTableHeaderCell>
          <JoyTableHeaderCell>Joined</JoyTableHeaderCell>
        </JoyTableRow>
      </JoyTableHead>
      <JoyTableBody>
        {users.map((user) => (
          <JoyTableRow key={user.id}>
            <JoyTableCell sx={{ fontWeight: "var(--joy-fontWeight-md)" }}>
              {user.email}
            </JoyTableCell>
            <JoyTableCell>
              <Chip
                color={getPlanChip(user.plan).color}
                size="sm"
                variant="soft"
              >
                {getPlanChip(user.plan).label}
              </Chip>
            </JoyTableCell>
            <JoyTableCell>
              <Chip
                color={getStatusChip(user.status).color}
                size="sm"
                variant="soft"
              >
                {getStatusChip(user.status).label}
              </Chip>
            </JoyTableCell>
            <JoyTableCell sx={{ textAlign: "right" }}>
              {user.campaignCount}
            </JoyTableCell>
            <JoyTableCell sx={{ textAlign: "right" }}>
              {user.taskCount}
            </JoyTableCell>
            <JoyTableCell>
              {new Date(user.created_at).toLocaleDateString()}
            </JoyTableCell>
          </JoyTableRow>
        ))}
      </JoyTableBody>
    </JoyTable>
  );
};
