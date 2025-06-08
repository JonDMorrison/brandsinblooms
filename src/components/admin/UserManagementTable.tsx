
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

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
  const getPlanBadgeColor = (plan: string) => {
    switch (plan) {
      case 'bloom': return 'bg-purple-100 text-purple-800';
      case 'sprout': return 'bg-green-100 text-green-800';
      case 'free_trial': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    return status === 'Active' 
      ? 'bg-green-100 text-green-800' 
      : 'bg-red-100 text-red-800';
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Email</TableHead>
          <TableHead>Plan</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Campaigns</TableHead>
          <TableHead>Content Tasks</TableHead>
          <TableHead>Joined</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow key={user.id}>
            <TableCell className="font-medium">{user.email}</TableCell>
            <TableCell>
              <Badge className={getPlanBadgeColor(user.plan)}>
                {user.plan.charAt(0).toUpperCase() + user.plan.slice(1)}
              </Badge>
            </TableCell>
            <TableCell>
              <Badge className={getStatusBadgeColor(user.status)}>
                {user.status}
              </Badge>
            </TableCell>
            <TableCell>{user.campaignCount}</TableCell>
            <TableCell>{user.taskCount}</TableCell>
            <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
