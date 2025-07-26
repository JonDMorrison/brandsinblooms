import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Plus, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

export const CRMCustomersPage: React.FC = () => {
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Customers</h1>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Customer
        </Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Customer Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              <Input placeholder="Search customers..." className="max-w-sm" />
            </div>
            <p className="text-muted-foreground">
              View and manage all your customers in one place. Track their interactions, preferences, and purchase history.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};