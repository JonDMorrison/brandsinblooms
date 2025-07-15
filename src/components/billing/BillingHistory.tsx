import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Receipt, Download, ExternalLink } from 'lucide-react';
import { useSubscription } from '@/contexts/SubscriptionContext';

// Mock data for billing history - in a real app, this would come from Stripe
const mockBillingHistory = [
  {
    id: '1',
    date: '2024-01-15',
    amount: '$29.00',
    status: 'paid',
    description: 'Sprout Plan - Monthly',
    invoiceUrl: '#'
  },
  {
    id: '2',
    date: '2023-12-15',
    amount: '$29.00',
    status: 'paid',
    description: 'Sprout Plan - Monthly',
    invoiceUrl: '#'
  },
  {
    id: '3',
    date: '2023-11-15',
    amount: '$29.00',
    status: 'paid',
    description: 'Sprout Plan - Monthly',
    invoiceUrl: '#'
  }
];

export const BillingHistory = () => {
  const { subscription } = useSubscription();
  const isTrialOrExpired = !subscription || subscription.plan === 'free_trial' || subscription.plan === 'expired';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Billing History
          </CardTitle>
          {!isTrialOrExpired && (
            <Button variant="outline" size="sm">
              <ExternalLink className="h-4 w-4 mr-2" />
              View All
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isTrialOrExpired ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
              <Receipt className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground mb-2">No billing history</p>
            <p className="text-xs text-muted-foreground">
              {subscription?.plan === 'free_trial' 
                ? 'Your billing history will appear here after upgrading'
                : 'Subscribe to a plan to see your billing history'
              }
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {mockBillingHistory.map((invoice) => (
              <div key={invoice.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-sm">{invoice.description}</p>
                    <Badge 
                      variant={invoice.status === 'paid' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {invoice.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(invoice.date).toLocaleDateString()} • {invoice.amount}
                  </p>
                </div>
                <Button variant="ghost" size="sm">
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            ))}

            {mockBillingHistory.length === 0 && (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">No invoices yet</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};