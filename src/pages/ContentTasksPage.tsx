
import React from 'react';
import { SidebarLayout } from '@/components/SidebarLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const ContentTasksPage = () => {
  return (
    <SidebarLayout>
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Content Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Content task management features coming soon.
            </p>
          </CardContent>
        </Card>
      </div>
    </SidebarLayout>
  );
};

export default ContentTasksPage;
