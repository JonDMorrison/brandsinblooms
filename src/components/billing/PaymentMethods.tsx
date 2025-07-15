import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreditCard, Plus, ExternalLink } from 'lucide-react';
import { CustomerPortalButton } from '@/components/subscription/CustomerPortalButton';
import { useSubscription } from '@/contexts/SubscriptionContext';

export const PaymentMethods = () => {
  const { subscription } = useSubscription();
  const isTrialOrExpired = !subscription || subscription.plan === 'free_trial' || subscription.plan === 'expired';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Payment Methods
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isTrialOrExpired ? (
          <div className="text-center py-6">
            <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
              <CreditCard className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              No payment method on file
            </p>
            <Button size="sm" className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Add Payment Method
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center">
                  <CreditCard className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">•••• •••• •••• 4242</p>
                  <p className="text-xs text-muted-foreground">Expires 12/25</p>
                </div>
              </div>
            </div>

            <CustomerPortalButton 
              variant="outline" 
              size="sm"
              className="w-full"
            />

            <div className="text-xs text-center text-muted-foreground">
              Manage payment methods securely through Stripe
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};