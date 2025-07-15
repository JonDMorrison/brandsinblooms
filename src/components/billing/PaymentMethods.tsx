import React from 'react';
import { EnhancedAppleCard } from '@/components/ui/enhanced-apple-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Plus, Shield, CheckCircle, Lock } from 'lucide-react';
import { CustomerPortalButton } from '@/components/subscription/CustomerPortalButton';
import { useSubscription } from '@/contexts/SubscriptionContext';

export const PaymentMethods = () => {
  const { subscription } = useSubscription();
  const isTrialOrExpired = !subscription || subscription.plan === 'free_trial' || subscription.plan === 'expired';

  return (
    <div className="space-y-6">
      {/* Payment Methods Card */}
      <EnhancedAppleCard variant="elevated" hoverEffect="subtle">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                <CreditCard className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold text-text-primary">Payment Methods</h3>
                <p className="text-sm text-text-secondary">Secure payment information</p>
              </div>
            </div>
            <Badge variant="outline" className="text-xs">
              <Shield className="h-3 w-3 mr-1" />
              Secure
            </Badge>
          </div>

          {isTrialOrExpired ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-surface-secondary rounded-full flex items-center justify-center mx-auto mb-4">
                <CreditCard className="h-8 w-8 text-text-secondary" />
              </div>
              <h4 className="font-medium text-text-primary mb-2">No payment method added</h4>
              <p className="text-sm text-text-secondary mb-6">
                {subscription?.plan === 'free_trial' 
                  ? "Add a payment method to continue seamlessly after your trial"
                  : "Add a payment method to reactivate your subscription"
                }
              </p>
              <Button size="sm" className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:opacity-90">
                <Plus className="h-4 w-4 mr-2" />
                Add Payment Method
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Mock payment method */}
              <div className="p-4 bg-surface-secondary rounded-lg border border-border-subtle hover:border-border-primary transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-8 bg-gradient-to-r from-blue-600 to-blue-700 rounded flex items-center justify-center">
                      <span className="text-white text-xs font-bold">VISA</span>
                    </div>
                    <div>
                      <div className="font-medium text-text-primary">•••• •••• •••• 4242</div>
                      <div className="text-sm text-text-secondary">Expires 12/25</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <Badge variant="secondary" className="text-xs">Default</Badge>
                  </div>
                </div>
              </div>
              
              <div className="pt-4 border-t border-border-subtle">
                <CustomerPortalButton variant="outline" size="sm" className="w-full" />
              </div>
            </div>
          )}
        </div>
      </EnhancedAppleCard>

      {/* Security Notice */}
      <EnhancedAppleCard surface="secondary" className="bg-green-50 dark:bg-green-950/10 border-green-200">
        <div className="p-4">
          <div className="flex items-start space-x-3">
            <Lock className="h-5 w-5 text-green-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-green-800 dark:text-green-200 text-sm">Secure & Encrypted</h4>
              <p className="text-green-700 dark:text-green-300 text-xs mt-1">
                All payment information is encrypted and securely processed by Stripe. We never store your card details.
              </p>
            </div>
          </div>
        </div>
      </EnhancedAppleCard>
    </div>
  );
};