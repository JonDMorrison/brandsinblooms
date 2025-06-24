
import React from 'react';
import { SidebarLayout } from '@/components/SidebarLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const AccountPage = () => {
  return (
    <SidebarLayout>
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Account Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Account management features coming soon.
            </p>
          </CardContent>
        </Card>
      </div>
    </SidebarLayout>
  );
};

export default AccountPage;
