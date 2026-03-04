import React, { useState } from 'react';
import { useSuppressionList, useSuppressionStats, useRemoveSuppression } from '@/hooks/useSuppressionList';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search,
  Trash2,
  ShieldOff,
  AlertTriangle,
  XCircle,
  MailX,
  ChevronLeft,
  ChevronRight,
  Shield
} from 'lucide-react';
import { format } from 'date-fns';

const PAGE_SIZE = 25;

export default function SuppressionListPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(0);

  // Debounce search
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: listData, isLoading } = useSuppressionList({
    search: debouncedSearch,
    page,
    pageSize: PAGE_SIZE
  });

  const { data: stats } = useSuppressionStats();
  const removeMutation = useRemoveSuppression();

  const handleRemove = async (id: string, email: string) => {
    await removeMutation.mutateAsync({ suppressionId: id, email });
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'bounced':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'complaint':
      case 'complained':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'unsubscribed':
        return <MailX className="h-4 w-4 text-muted-foreground" />;
      default:
        return <ShieldOff className="h-4 w-4" />;
    }
  };

  const getTypeBadge = (type: string) => {
    const variants: Record<string, 'destructive' | 'secondary' | 'outline'> = {
      'bounced': 'destructive',
      'complaint': 'destructive',
      'complained': 'destructive',
      'unsubscribed': 'secondary',
    };
    return (
      <Badge variant={variants[type] || 'outline'} className="gap-1 capitalize">
        {getTypeIcon(type)}
        {type}
      </Badge>
    );
  };

  const totalPages = Math.ceil((listData?.count || 0) / PAGE_SIZE);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Email Suppression List
          </h1>
          <p className="text-muted-foreground">
            Addresses blocked due to explicit unsubscribe, hard bounce, or spam complaint.
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
            <p className="text-xs text-muted-foreground">Total Suppressed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-destructive">{stats?.byType?.bounced || 0}</div>
            <p className="text-xs text-muted-foreground">Hard Bounces</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-orange-500">{(stats?.byType?.complaint || 0) + (stats?.byType?.complained || 0)}</div>
            <p className="text-xs text-muted-foreground">Complaints</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats?.byType?.unsubscribed || 0}</div>
            <p className="text-xs text-muted-foreground">Unsubscribed</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Actions */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle>Suppressed Emails</CardTitle>
              <CardDescription>
                Emails that have bounced, complained, or unsubscribed
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Table */}
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map(i => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : listData?.data.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ShieldOff className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No suppressed emails found</p>
                {debouncedSearch && (
                  <p className="text-sm mt-1">Try adjusting your search</p>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Suppressed At</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {listData?.data.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">{record.email}</TableCell>
                      <TableCell>{getTypeBadge(record.suppression_type)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                        {record.reason || '-'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(record.suppressed_at), 'MMM d, yyyy HH:mm')}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {record.auto_suppressed ? 'Auto' : 'Manual'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemove(record.id, record.email)}
                          disabled={removeMutation.isPending}
                          title="Remove from suppression list"
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <p className="text-sm text-muted-foreground">
                  Showing {page * PAGE_SIZE + 1} - {Math.min((page + 1) * PAGE_SIZE, listData?.count || 0)} of {listData?.count || 0}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">
                    Page {page + 1} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => p + 1)}
                    disabled={page >= totalPages - 1}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
            <div className="space-y-2 text-sm">
              <p className="font-medium">How suppression works:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li><strong>Hard bounces</strong> - Automatically suppressed when an email permanently fails to deliver</li>
                <li><strong>Complaints</strong> - Automatically suppressed when a recipient marks your email as spam</li>
                <li><strong>Unsubscribes</strong> - Automatically suppressed when a recipient clicks the unsubscribe link</li>
                <li><strong>Manual</strong> - Added by you or your team to prevent sending to specific addresses</li>
              </ul>
              <p className="text-muted-foreground mt-4">
                Suppressed emails are excluded from all campaigns and automations. Removing a suppression allows
                future emails to be sent, but won't affect past bounces or complaints recorded by email providers.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
