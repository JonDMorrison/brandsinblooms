import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Eye, Clock, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDistanceToNow, format } from "date-fns";

interface AdminTenant {
  tenant_id: string;
  company_name: string;
  website: string;
  city: string;
  region: string;
  country: string;
  onboarding_completed_at: string | null;
  tenant_created_at: string;
  primary_contact_email: string;
  primary_contact_name: string;
  primary_contact_last_login: string | null;
  plan: string;
  subscription_status: string;
  trial_start: string | null;
  trial_end: string | null;
  current_period_end: string | null;
  last_activity_at: string | null;
  is_trialing: boolean;
  is_paid_active: boolean;
  trial_not_expired: boolean;
  is_active: boolean;
}

interface TenantTableProps {
  tenants: AdminTenant[];
  loading?: boolean;
  onViewTenant: (tenant: AdminTenant) => void;
  onExtendTrial: (tenantId: string, days: number) => void;
  onToggleActive: (tenantId: string, active: boolean) => void;
}

export const TenantTable = ({
  tenants,
  loading,
  onViewTenant,
  onExtendTrial,
  onToggleActive,
}: TenantTableProps) => {
  const getStatusBadge = (tenant: AdminTenant) => {
    if (!tenant.is_active) {
      return <Badge variant="secondary">Inactive</Badge>;
    }
    if (tenant.is_trialing) {
      return <Badge variant="outline" className="border-yellow-500 text-yellow-700">Trialing</Badge>;
    }
    if (tenant.is_paid_active) {
      return <Badge variant="default" className="bg-green-500">Active</Badge>;
    }
    return <Badge variant="destructive">Expired</Badge>;
  };

  const getActivityDot = (lastActivity: string | null) => {
    if (!lastActivity) return <div className="w-2 h-2 rounded-full bg-gray-400" />;
    
    const hoursAgo = (Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60);
    
    if (hoursAgo < 24) {
      return <div className="w-2 h-2 rounded-full bg-green-400" />;
    } else if (hoursAgo < 168) { // 7 days
      return <div className="w-2 h-2 rounded-full bg-yellow-400" />;
    } else {
      return <div className="w-2 h-2 rounded-full bg-gray-400" />;
    }
  };

  const formatLocation = (city: string, region: string, country: string) => {
    const parts = [city, region, country].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : "—";
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <div className="h-4 bg-muted animate-pulse rounded w-1/4" />
                <div className="h-4 bg-muted animate-pulse rounded w-1/3" />
                <div className="h-4 bg-muted animate-pulse rounded w-1/6" />
                <div className="h-4 bg-muted animate-pulse rounded w-1/4" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (tenants.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <p className="text-muted-foreground">No tenants match your filters</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Company</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Trial Ends</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last Activity</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tenants.map((tenant) => (
            <TableRow key={tenant.tenant_id} className="cursor-pointer hover:bg-muted/50">
              <TableCell>
                <div className="font-medium">
                  <button 
                    onClick={() => onViewTenant(tenant)}
                    className="text-primary hover:underline text-left"
                  >
                    {tenant.company_name || "Unnamed Company"}
                  </button>
                  {tenant.website && (
                    <div className="text-sm text-muted-foreground">
                      {tenant.website}
                    </div>
                  )}
                </div>
              </TableCell>
              
              <TableCell>
                <div>
                  <div className="font-medium">{tenant.primary_contact_name || "—"}</div>
                  <a 
                    href={`mailto:${tenant.primary_contact_email}`}
                    className="text-sm text-muted-foreground hover:text-primary"
                  >
                    {tenant.primary_contact_email}
                  </a>
                </div>
              </TableCell>
              
              <TableCell className="text-sm">
                {formatLocation(tenant.city, tenant.region, tenant.country)}
              </TableCell>
              
              <TableCell>
                <div>
                  <div className="font-medium capitalize">{tenant.plan}</div>
                  <div className="text-sm text-muted-foreground capitalize">
                    {tenant.subscription_status}
                  </div>
                </div>
              </TableCell>
              
              <TableCell>
                {tenant.trial_end ? (
                  <div className="text-sm">
                    {format(new Date(tenant.trial_end), "MMM d, yyyy")}
                    <div className="text-muted-foreground">
                      {tenant.trial_not_expired ? 
                        formatDistanceToNow(new Date(tenant.trial_end)) + " left" :
                        "Expired"
                      }
                    </div>
                  </div>
                ) : (
                  "—"
                )}
              </TableCell>
              
              <TableCell>
                {getStatusBadge(tenant)}
              </TableCell>
              
              <TableCell>
                <div className="flex items-center gap-2">
                  {getActivityDot(tenant.last_activity_at)}
                  <span className="text-sm">
                    {tenant.last_activity_at ? 
                      formatDistanceToNow(new Date(tenant.last_activity_at)) + " ago" :
                      "Never"
                    }
                  </span>
                </div>
              </TableCell>
              
              <TableCell className="text-sm">
                {format(new Date(tenant.tenant_created_at), "MMM d, yyyy")}
              </TableCell>
              
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onViewTenant(tenant)}>
                      <Eye className="mr-2 h-4 w-4" />
                      View Details
                    </DropdownMenuItem>
                    {tenant.is_trialing && (
                      <DropdownMenuItem onClick={() => onExtendTrial(tenant.tenant_id, 7)}>
                        <Clock className="mr-2 h-4 w-4" />
                        Extend Trial (+7 days)
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem 
                      onClick={() => onToggleActive(tenant.tenant_id, !tenant.is_active)}
                    >
                      {tenant.is_active ? "Deactivate" : "Activate"}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
};