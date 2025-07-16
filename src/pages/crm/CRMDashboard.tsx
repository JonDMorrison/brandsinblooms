import React, { useState, useEffect } from 'react';
import { SubscriptionGate } from '@/components/SubscriptionGate';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Mail, Target, TrendingUp, MessageSquare, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';

const CRMDashboard = () => {
  const [customerStats, setCustomerStats] = useState({
    total: 0,
    smsOptedIn: 0,
    smsOptInRate: 0
  });

  useEffect(() => {
    fetchCustomerStats();
  }, []);

  const fetchCustomerStats = async () => {
    try {
      const { data: customers, error } = await supabase
        .from('crm_customers')
        .select('sms_opt_in');

      if (error) throw error;

      const total = customers?.length || 0;
      const smsOptedIn = customers?.filter(c => c.sms_opt_in).length || 0;
      const smsOptInRate = total > 0 ? (smsOptedIn / total) * 100 : 0;

      setCustomerStats({
        total,
        smsOptedIn,
        smsOptInRate
      });
    } catch (error) {
      console.error('Error fetching customer stats:', error);
    }
  };

  const showSMSNudge = customerStats.total > 0 && customerStats.smsOptInRate < 25;

  return (
    <SubscriptionGate 
      requiredPlan="bloom" 
      feature="CRM Dashboard"
    >
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">CRM Dashboard</h1>
            <p className="text-muted-foreground">
              Manage your garden center customers with targeted campaigns and segmentation
            </p>
          </div>
        </div>

        {/* SMS Opt-in Nudge */}
        {showSMSNudge && (
          <Card className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
            <CardContent className="p-6">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <AlertCircle className="h-6 w-6 text-orange-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-orange-900 dark:text-orange-100">
                    🧑‍🌾 {Math.round(100 - customerStats.smsOptInRate)}% of your customers aren't opted in for SMS
                  </h3>
                  <p className="text-orange-700 dark:text-orange-200 mt-1">
                    Send a signup message or add opt-in prompts to your forms to grow your SMS list.
                  </p>
                  <div className="mt-3 flex items-center space-x-3">
                    <Button asChild size="sm">
                      <Link to="/crm/sms-campaigns/new?template=invite">
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Create SMS Invite Campaign
                      </Link>
                    </Button>
                    <span className="text-sm text-orange-600 dark:text-orange-300">
                      {customerStats.smsOptedIn} of {customerStats.total} customers opted in
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{customerStats.total}</div>
              <p className="text-xs text-muted-foreground">
                Active in your database
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">SMS Opt-ins</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{customerStats.smsOptedIn}</div>
              <p className="text-xs text-muted-foreground">
                {customerStats.smsOptInRate.toFixed(1)}% opt-in rate
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Segments</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">
                Create your first segment
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Email Campaigns</CardTitle>
              <Mail className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">
                Send your first campaign
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Open Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0%</div>
              <p className="text-xs text-muted-foreground">
                No campaigns sent yet
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Getting Started Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick Start Guide</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-medium">1. Import Your Customers</h4>
                <p className="text-sm text-muted-foreground">
                  Upload your customer list or add customers manually to get started
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">2. Create Customer Segments</h4>
                <p className="text-sm text-muted-foreground">
                  Group customers by persona: Newbie, Struggler, Regular, or Expert
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">3. Send Your First Campaign</h4>
                <p className="text-sm text-muted-foreground">
                  Use our garden center templates to create targeted emails
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Garden Center CRM Features</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-medium">Customer Personas</h4>
                <p className="text-sm text-muted-foreground">
                  Pre-built segments for different gardening skill levels
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Seasonal Campaigns</h4>
                <p className="text-sm text-muted-foreground">
                  Templates for spring prep, summer care, and fall cleanup
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Plant Care Automation</h4>
                <p className="text-sm text-muted-foreground">
                  Triggered emails based on purchase history and plant care needs
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </SubscriptionGate>
  );
};

export default CRMDashboard;