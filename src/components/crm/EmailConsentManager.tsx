import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Mail, 
  Users, 
  CheckCircle, 
  XCircle, 
  HelpCircle, 
  Send, 
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getConsentStats, ConsentStats } from '@/lib/crm/emailConsent';
import { OptInRequestModal } from './OptInRequestModal';
import { toast } from 'sonner';

export function EmailConsentManager() {
  const { user } = useAuth();
  const [stats, setStats] = useState<ConsentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showOptInModal, setShowOptInModal] = useState(false);

  const fetchStats = async () => {
    if (!user?.user_metadata?.tenant_id) return;
    
    setLoading(true);
    const data = await getConsentStats(user.user_metadata.tenant_id);
    setStats(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchStats();
  }, [user]);

  const getOptInPercentage = () => {
    if (!stats || stats.total_customers === 0) return 0;
    return Math.round((stats.opted_in_count / stats.total_customers) * 100);
  };

  const handleOptInRequestComplete = () => {
    setShowOptInModal(false);
    fetchStats();
    toast.success('Opt-in requests sent successfully');
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading consent statistics...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Email Consent Management</h2>
          <p className="text-muted-foreground">
            Manage marketing consent for your contacts
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchStats}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Contacts</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_customers || 0}</div>
            <p className="text-xs text-muted-foreground">
              With email addresses
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Opted In</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats?.opted_in_count || 0}</div>
            <p className="text-xs text-muted-foreground">
              Can receive marketing
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Opted Out</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats?.opted_out_count || 0}</div>
            <p className="text-xs text-muted-foreground">
              Unsubscribed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unknown</CardTitle>
            <HelpCircle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats?.unknown_count || 0}</div>
            <p className="text-xs text-muted-foreground">
              No consent recorded
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Consent Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Marketing Consent Coverage</CardTitle>
          <CardDescription>
            Percentage of contacts with explicit marketing consent
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Progress value={getOptInPercentage()} className="flex-1" />
            <span className="text-sm font-medium w-12">{getOptInPercentage()}%</span>
          </div>
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-green-500" />
              <span>Opted In ({stats?.opted_in_count || 0})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-red-500" />
              <span>Opted Out ({stats?.opted_out_count || 0})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-yellow-500" />
              <span>Unknown ({stats?.unknown_count || 0})</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Unknown Consent Warning */}
      {(stats?.unknown_count || 0) > 0 && (
        <Alert variant="default" className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertTitle className="text-yellow-800 dark:text-yellow-200">
            {stats?.unknown_count} contacts without consent
          </AlertTitle>
          <AlertDescription className="text-yellow-700 dark:text-yellow-300">
            <p className="mb-4">
              These contacts were imported from purchases, registrations, or POS syncs without 
              explicit marketing consent. It is not safe to send them marketing campaigns.
            </p>
            <p className="mb-4">
              You can send a one-time opt-in request email to invite them to subscribe to your 
              marketing communications.
            </p>
            <Button 
              onClick={() => setShowOptInModal(true)}
              className="bg-yellow-600 hover:bg-yellow-700 text-white"
            >
              <Send className="mr-2 h-4 w-4" />
              Send Opt-In Request to Unknown Contacts
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Mail className="h-5 w-5" />
            About Email Consent
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="default" className="bg-green-500">Opted In</Badge>
              </div>
              <p>
                Contacts who have explicitly agreed to receive marketing emails. 
                They can be included in campaigns.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="destructive">Opted Out</Badge>
              </div>
              <p>
                Contacts who have explicitly declined marketing emails. 
                They will never receive marketing campaigns.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Unknown</Badge>
              </div>
              <p>
                Contacts imported from purchases or registrations without explicit consent. 
                Cannot receive marketing until they opt in.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Opt-In Request Modal */}
      <OptInRequestModal
        open={showOptInModal}
        onOpenChange={setShowOptInModal}
        unknownCount={stats?.unknown_count || 0}
        onComplete={handleOptInRequestComplete}
      />
    </div>
  );
}
