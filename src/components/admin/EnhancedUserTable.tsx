
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MoreHorizontal, Mail, MapPin, Calendar, Coins } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
}

interface EnhancedUserTableProps {
  users: AdminUserData[];
}

export const EnhancedUserTable = ({ users }: EnhancedUserTableProps) => {
  const getPlanBadgeColor = (plan: string) => {
    switch (plan) {
      case 'bloom': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'sprout': return 'bg-green-100 text-green-800 border-green-200';
      case 'free_trial': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    return status === 'Active' 
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

  return (
    <Card className="rounded-xl">
      <CardHeader>
        <CardTitle className="text-xl">All Users ({users.length})</CardTitle>
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
              
              return (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">
                          {getInitials(user.email, user.company_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{user.email}</div>
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
                      {user.location_info && (
                        <div className="text-sm text-gray-500 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {user.location_info}
                        </div>
                      )}
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
                      <Coins className="w-4 h-4 text-yellow-600" />
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
                        <Button variant="ghost" className="h-8 w-8 p-0">
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
