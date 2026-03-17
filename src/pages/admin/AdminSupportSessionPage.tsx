import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Calendar,
  Clock,
  Globe,
  LogOut,
  Mail,
  MapPin,
  RefreshCw,
  Shield,
  User,
} from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useIsSuperAdmin } from '@/hooks/useIsSuperAdmin';
import { useSupportSession } from '@/contexts/SupportSessionContext';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

interface TenantOverview {
  tenant_id: string;
  company_name: string | null;
  website: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  onboarding_completed_at: string | null;
  tenant_created_at: string;
  primary_contact_email: string | null;
  primary_contact_name: string | null;
  primary_contact_last_login: string | null;
  plan: string | null;
  subscription_status: string | null;
  trial_start: string | null;
  trial_end: string | null;
  current_period_end: string | null;
  last_activity_at: string | null;
  is_trialing: boolean;
  is_paid_active: boolean;
  trial_not_expired: boolean;
  is_active: boolean;
}

export default function AdminSupportSessionPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const navigate = useNavigate();
  const { data: isSuperAdmin, isLoading: adminLoading } = useIsSuperAdmin();
  const { supportSession, isInSupportSession, endSession, isLoading: sessionLoading } =
    useSupportSession();
  const [tenant, setTenant] = useState<TenantOverview | null>(null);
  const [loadingTenant, setLoadingTenant] = useState(true);
  const [endingSession, setEndingSession] = useState(false);

  // Fetch tenant details
  useEffect(() => {
    if (!tenantId || !isSuperAdmin) return;

    async function fetchTenant() {
      setLoadingTenant(true);
      try {
        const { data, error } = await supabase
          .from('admin_tenant_overview')
          .select('*')
          .eq('tenant_id', tenantId)
          .maybeSingle();

        if (error) throw error;
        setTenant(data as unknown as TenantOverview);
      } catch (err) {
        console.error('Failed to load tenant details', err);
        toast.error('Could not load tenant information');
      } finally {
        setLoadingTenant(false);
      }
    }

    void fetchTenant();
  }, [tenantId, isSuperAdmin]);

  const handleEndSession = async () => {
    setEndingSession(true);
    try {
      await endSession();
      toast.success('Support session ended', {
        description: 'Session has been closed and audit log updated.',
      });
      navigate('/admin/tenants');
    } catch (err) {
      toast.error('Failed to end session', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setEndingSession(false);
    }
  };

  if (adminLoading || sessionLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  // If there's no active support session for this tenant, redirect to tenant list
  if (
    !isInSupportSession ||
    (supportSession && supportSession.tenantId !== tenantId)
  ) {
    return <Navigate to="/admin/tenants" replace />;
  }

  const location = [tenant?.city, tenant?.region, tenant?.country]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="min-h-screen bg-background pt-10">
      {/* Secondary page header (banner is rendered globally above this) */}
      <div className="border-b bg-amber-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden="true" />
            <div>
              <h1 className="text-lg font-semibold text-amber-900">
                Support Session — {supportSession?.tenantName ?? tenantId}
              </h1>
              <p className="text-xs text-amber-700">
                Reason: {supportSession?.reason ?? '—'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/admin/tenants')}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Tenants
            </Button>
            <Button
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={handleEndSession}
              disabled={endingSession}
              data-testid="end-session-btn"
            >
              <LogOut className="mr-2 h-4 w-4" />
              {endingSession ? 'Ending…' : 'End Session'}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Session Info */}
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-amber-900 flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Active Support Session
            </CardTitle>
            <CardDescription className="text-amber-700">
              All actions during this session are audited. Your admin identity is preserved.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-amber-700 text-xs font-medium uppercase tracking-wide">Tenant</p>
                <p className="font-medium text-amber-950">{supportSession?.tenantName}</p>
              </div>
              <div>
                <p className="text-amber-700 text-xs font-medium uppercase tracking-wide">Reason</p>
                <p className="font-medium text-amber-950">{supportSession?.reason}</p>
              </div>
              <div>
                <p className="text-amber-700 text-xs font-medium uppercase tracking-wide">Started</p>
                <p className="font-medium text-amber-950">
                  {supportSession?.startedAt
                    ? format(new Date(supportSession.startedAt), 'PPp')
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-amber-700 text-xs font-medium uppercase tracking-wide">Duration</p>
                <p className="font-medium text-amber-950 flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {supportSession?.startedAt
                    ? formatDistanceToNow(new Date(supportSession.startedAt), {
                        includeSeconds: true,
                      })
                    : '—'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tenant Info */}
        {loadingTenant ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : tenant ? (
          <div className="space-y-6">
            {/* Overview */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <CardTitle>{tenant.company_name ?? 'Unnamed Company'}</CardTitle>
                      <CardDescription>{tenant.primary_contact_email}</CardDescription>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    {tenant.is_active ? (
                      <Badge variant="default">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                    {tenant.is_trialing && (
                      <Badge variant="outline">Trial</Badge>
                    )}
                    {tenant.is_paid_active && (
                      <Badge variant="default">Paid</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* Contact & Company Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Primary Contact
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{tenant.primary_contact_name ?? '—'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    {tenant.primary_contact_email ? (
                      <a
                        href={`mailto:${tenant.primary_contact_email}`}
                        className="text-primary hover:underline"
                      >
                        {tenant.primary_contact_email}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                  {tenant.primary_contact_last_login && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      <span>
                        Last login{' '}
                        {formatDistanceToNow(
                          new Date(tenant.primary_contact_last_login),
                          { addSuffix: true },
                        )}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    Company Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {tenant.website && (
                    <div className="flex items-center gap-2">
                      <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                      <a
                        href={`https://${tenant.website.replace(/https?:\/\//, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {tenant.website}
                      </a>
                    </div>
                  )}
                  {location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{location}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>
                      Joined{' '}
                      {format(new Date(tenant.tenant_created_at), 'PPP')}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Subscription */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Subscription</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide mb-1">
                      Plan
                    </p>
                    <p className="font-medium">{tenant.plan ?? 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide mb-1">
                      Status
                    </p>
                    <p className="font-medium">{tenant.subscription_status ?? 'N/A'}</p>
                  </div>
                  {tenant.trial_end && (
                    <div>
                      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide mb-1">
                        {tenant.is_trialing ? 'Trial Ends' : 'Trial Ended'}
                      </p>
                      <p className="font-medium">
                        {format(new Date(tenant.trial_end), 'PPP')}
                        {tenant.trial_not_expired && (
                          <span className="ml-1 text-yellow-600 text-xs">
                            ({formatDistanceToNow(new Date(tenant.trial_end))} remaining)
                          </span>
                        )}
                      </p>
                    </div>
                  )}
                  {tenant.current_period_end && (
                    <div>
                      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide mb-1">
                        Current Period Ends
                      </p>
                      <p className="font-medium">
                        {format(new Date(tenant.current_period_end), 'PPP')}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Quick Links */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Admin Actions</CardTitle>
                <CardDescription>
                  Navigate to detailed management views for this tenant.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Separator className="mb-4" />
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      navigate(`/admin/tenants/${tenantId}/email`)
                    }
                  >
                    <Mail className="mr-2 h-4 w-4" />
                    Email Management
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/admin/tenants')}
                  >
                    <Building2 className="mr-2 h-4 w-4" />
                    All Tenants
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Tenant information could not be loaded.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
