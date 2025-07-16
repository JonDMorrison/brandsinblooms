import React from 'react';
import { SubscriptionGate } from '@/components/SubscriptionGate';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Mail, Target, TrendingUp } from 'lucide-react';

const CRMDashboard = () => {
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

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">
                +0% from last month
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