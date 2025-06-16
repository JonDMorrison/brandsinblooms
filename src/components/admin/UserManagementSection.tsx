
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserManagementTable } from "./UserManagementTable";
import { EmptyState } from "@/components/ui/empty-state";
import { Users, Search } from "lucide-react";
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

export const UserManagementSection = ({ users }: UserManagementSectionProps) => {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-garden-green-dark">Basic User Overview</h2>
        <Button className="bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-2">
          Invite User
        </Button>
      </div>

      <Card className="rounded-xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Quick User Stats ({users.length})</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No users yet"
              description="Invite your first user or verify your Stripe setup."
              action={{
                label: "Invite User",
                onClick: () => console.log("Invite user clicked")
              }}
            />
          ) : (
            <UserManagementTable users={filteredUsers} />
          )}
        </CardContent>
      </Card>
    </div>
  );
};
