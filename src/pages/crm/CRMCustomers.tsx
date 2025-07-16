import React, { useState } from 'react';
import { SubscriptionGate } from '@/components/SubscriptionGate';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Search, 
  Upload, 
  Filter,
  Users,
  Phone,
  Mail,
  Calendar
} from 'lucide-react';

const CRMCustomers = () => {
  const [searchTerm, setSearchTerm] = useState('');

  const customerPersonas = [
    { name: 'Newbie', count: 0, color: 'bg-blue-100 text-blue-800' },
    { name: 'Struggler', count: 0, color: 'bg-yellow-100 text-yellow-800' },
    { name: 'Regular', count: 0, color: 'bg-green-100 text-green-800' },
    { name: 'Expert', count: 0, color: 'bg-purple-100 text-purple-800' },
  ];

  return (
    <SubscriptionGate 
      requiredPlan="bloom" 
      feature="Customer Management"
    >
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Customers</h1>
            <p className="text-muted-foreground">
              Manage your garden center customers and their gardening journey
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">
              <Upload className="h-4 w-4 mr-2" />
              Import CSV
            </Button>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Customer
            </Button>
          </div>
        </div>

        {/* Customer Personas Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {customerPersonas.map((persona) => (
            <Card key={persona.name}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{persona.name}</p>
                    <p className="text-2xl font-bold">{persona.count}</p>
                  </div>
                  <Badge className={persona.color}>{persona.name}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Search and Filter */}
        <Card>
          <CardHeader>
            <CardTitle>Customer List</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search customers by name, email, or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button variant="outline">
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
            </div>

            {/* Empty State */}
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No customers yet</h3>
              <p className="text-muted-foreground mb-4">
                Start building your customer database by importing existing customers or adding them manually
              </p>
              <div className="flex justify-center gap-2">
                <Button variant="outline">
                  <Upload className="h-4 w-4 mr-2" />
                  Import from CSV
                </Button>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Customer
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Customer Import Guide */}
        <Card>
          <CardHeader>
            <CardTitle>Getting Started with Customer Data</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" />
                  <h4 className="font-medium">Email & Contact Info</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Import customer emails, names, and phone numbers for targeted campaigns
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <h4 className="font-medium">Gardening Personas</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Categorize customers by their gardening experience level
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  <h4 className="font-medium">Purchase History</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Track when customers last purchased and their lifetime value
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </SubscriptionGate>
  );
};

export default CRMCustomers;