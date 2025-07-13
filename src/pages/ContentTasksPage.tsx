
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const ContentTasksPage = () => {
  return (
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
  );
};

export default ContentTasksPage;
