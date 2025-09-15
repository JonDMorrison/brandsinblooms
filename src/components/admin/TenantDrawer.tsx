import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  Building2, 
  Mail, 
  Globe, 
  MapPin, 
  Calendar, 
  Clock,
  CreditCard,
  User,
  ExternalLink
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

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

interface TenantDrawerProps {
  tenant: AdminTenant | null;
  open: boolean;
  onClose: () => void;
  onExtendTrial: (tenantId: string, days: number) => void;
  onToggleActive: (tenantId: string, active: boolean) => void;
}

export const TenantDrawer = ({
  tenant,
  open,
  onClose,
  onExtendTrial,
  onToggleActive,
}: TenantDrawerProps) => {
  if (!tenant) return null;

  const formatLocation = (city: string, region: string, country: string) => {
    const parts = [city, region, country].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : "Not specified";
  };

  const getStatusBadge = () => {
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

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="pb-6">
          <SheetTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {tenant.company_name || "Unnamed Company"}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-6">
          {/* Status and Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Status & Actions</span>
                {getStatusBadge()}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {tenant.is_trialing && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onExtendTrial(tenant.tenant_id, 7)}
                  >
                    <Clock className="mr-2 h-4 w-4" />
                    Extend Trial (+7 days)
                  </Button>
                )}
                <Button
                  variant={tenant.is_active ? "destructive" : "default"}
                  size="sm"
                  onClick={() => onToggleActive(tenant.tenant_id, !tenant.is_active)}
                >
                  {tenant.is_active ? "Deactivate Tenant" : "Activate Tenant"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Company Information */}
          <Card>
            <CardHeader>
              <CardTitle>Company Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                {tenant.website && (
                  <div className="flex items-center gap-3">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Website</p>
                      <a
                        href={`https://${tenant.website.replace(/https?:\/\//, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline flex items-center gap-1"
                      >
                        {tenant.website}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Location</p>
                    <p className="text-sm text-muted-foreground">
                      {formatLocation(tenant.city, tenant.region, tenant.country)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Created</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(tenant.tenant_created_at), "PPP")}
                    </p>
                  </div>
                </div>

                {tenant.onboarding_completed_at && (
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Onboarding Completed</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(tenant.onboarding_completed_at), "PPP")}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Primary Contact */}
          <Card>
            <CardHeader>
              <CardTitle>Primary Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Name</p>
                  <p className="text-sm text-muted-foreground">
                    {tenant.primary_contact_name || "Not specified"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Email</p>
                  <a
                    href={`mailto:${tenant.primary_contact_email}`}
                    className="text-sm text-primary hover:underline"
                  >
                    {tenant.primary_contact_email}
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Last Login</p>
                  <p className="text-sm text-muted-foreground">
                    {tenant.primary_contact_last_login
                      ? format(new Date(tenant.primary_contact_last_login), "PPP")
                      : "Never"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Last Activity</p>
                  <p className="text-sm text-muted-foreground">
                    {tenant.last_activity_at
                      ? formatDistanceToNow(new Date(tenant.last_activity_at)) + " ago"
                      : "Never"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Subscription Details */}
          <Card>
            <CardHeader>
              <CardTitle>Subscription Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Plan</p>
                  <p className="text-sm text-muted-foreground capitalize">
                    {tenant.plan}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Status</p>
                  <p className="text-sm text-muted-foreground capitalize">
                    {tenant.subscription_status}
                  </p>
                </div>
              </div>

              {tenant.trial_start && (
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Trial Started</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(tenant.trial_start), "PPP")}
                    </p>
                  </div>
                </div>
              )}

              {tenant.trial_end && (
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">
                      {tenant.is_trialing ? "Trial Ends" : "Trial Ended"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(tenant.trial_end), "PPP")}
                      {tenant.trial_not_expired && (
                        <span className="text-yellow-600 ml-2">
                          ({formatDistanceToNow(new Date(tenant.trial_end))} remaining)
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              )}

              {tenant.current_period_end && (
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Current Period Ends</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(tenant.current_period_end), "PPP")}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
};