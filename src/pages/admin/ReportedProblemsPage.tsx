import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReportedProblems } from '@/hooks/reportProblem/useReportedProblems';
import { useIsSuperAdmin } from '@/hooks/useIsSuperAdmin';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/NativeSelect';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ProblemStatusBadge } from '@/components/reportProblem/ProblemStatusBadge';
import { ProblemPriorityBadge } from '@/components/reportProblem/ProblemPriorityBadge';
import { AlertTriangle, Search, Eye } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const ReportedProblemsPage: React.FC = () => {
  const navigate = useNavigate();
  const { data: isSuperAdmin } = useIsSuperAdmin();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchUrl, setSearchUrl] = useState('');

  const { data: problems, isLoading } = useReportedProblems({
    status: statusFilter || undefined,
    url: searchUrl || undefined,
  });

  if (!isSuperAdmin) {
    return (
      <div className="container py-8">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You don't have permission to view this page.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Reported Problems</h1>
          <p className="text-muted-foreground">
            View and manage user-reported problems
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-6 w-6 text-orange-500" />
          <span className="text-sm text-muted-foreground">
            {problems?.length || 0} total problems
          </span>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <NativeSelect
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                options={[
                  { value: '', label: 'All statuses' },
                  { value: 'open', label: 'Open' },
                  { value: 'investigating', label: 'Investigating' },
                  { value: 'resolved', label: 'Resolved' },
                  { value: 'closed', label: 'Closed' },
                ]}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Search URL</label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Filter by URL..."
                  value={searchUrl}
                  onChange={(e) => setSearchUrl(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Problems Table */}
      <Card>
        <CardHeader>
          <CardTitle>Problems List</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading problems...
            </div>
          ) : !problems || problems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No problems found.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {problems.map((problem) => (
                  <TableRow key={problem.id}>
                    <TableCell className="font-medium max-w-xs truncate">
                      {problem.title}
                    </TableCell>
                    <TableCell className="text-sm">
                      {problem.user_email}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-sm">
                      <a
                        href={problem.captured_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {problem.captured_url}
                      </a>
                    </TableCell>
                    <TableCell>
                      <ProblemStatusBadge status={problem.status} />
                    </TableCell>
                    <TableCell>
                      <ProblemPriorityBadge priority={problem.priority} />
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDistanceToNow(new Date(problem.created_at), {
                        addSuffix: true,
                      })}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          navigate(`/admin/reported-problems/${problem.id}`)
                        }
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportedProblemsPage;
