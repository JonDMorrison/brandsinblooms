import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, Loader2, Users, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { isSuperAdmin } from '@/utils/adminUtils';
import { Navigate } from 'react-router-dom';

export const AdminReportsPage = () => {
  const { user } = useAuth();
  const [sending, setSending] = useState(false);

  // Check if user is super admin
  if (!user || !isSuperAdmin(user.email || '')) {
    return <Navigate to="/dashboard" replace />;
  }

  const sendTrialUsersReport = async () => {
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-trial-users-report');
      
      if (error) {
        throw error;
      }

      toast.success(`Report sent successfully! ${data.totalUsers} users included in report.`);
    } catch (error: any) {
      console.error('Error sending report:', error);
      toast.error(error.message || 'Failed to send report');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Admin Reports</h1>
          <p className="text-muted-foreground">Generate and send administrative reports</p>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-primary" />
                <CardTitle>Trial Users Report</CardTitle>
              </div>
              <CardDescription>
                Send a comprehensive report of all trial users to admin emails
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="bg-muted p-4 rounded-lg">
                  <h4 className="font-semibold mb-2">Report includes:</h4>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>• Email addresses</li>
                    <li>• Full names</li>
                    <li>• Company names</li>
                    <li>• Signup dates</li>
                    <li>• Trial end dates</li>
                    <li>• Days remaining</li>
                    <li>• Trial status (Active/Expired)</li>
                  </ul>
                </div>

                <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
                  <div className="flex items-start space-x-2">
                    <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                        Email recipients:
                      </p>
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        jon@brandsinblooms.com, jeff@brandsinblooms.com
                      </p>
                    </div>
                  </div>
                </div>

                <Button 
                  onClick={sendTrialUsersReport} 
                  disabled={sending}
                  className="w-full"
                  size="lg"
                >
                  {sending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending Report...
                    </>
                  ) : (
                    <>
                      <FileText className="mr-2 h-4 w-4" />
                      Send Trial Users Report
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
