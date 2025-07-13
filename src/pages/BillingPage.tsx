
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const BillingPage = () => {
  return (
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
  );
};

export default BillingPage;
