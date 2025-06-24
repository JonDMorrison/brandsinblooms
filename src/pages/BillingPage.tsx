
import React from 'react';
import { SidebarLayout } from '@/components/SidebarLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const BillingPage = () => {
  return (
    <SidebarLayout>
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Billing & Subscription</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Billing management features coming soon.
            </p>
          </CardContent>
        </Card>
      </div>
    </SidebarLayout>
  );
};

export default BillingPage;
