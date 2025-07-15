import React from 'react';
import { EnhancedAppleCard } from '@/components/ui/enhanced-apple-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Receipt, Download, ExternalLink, Calendar, CreditCard, FileText, Eye } from 'lucide-react';
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-text-primary">Billing History</h2>
          <p className="text-text-secondary mt-1">Download invoices and view payment history</p>
        </div>
        <div className="flex items-center space-x-2">
          <Receipt className="h-5 w-5 text-text-secondary" />
          <span className="text-sm text-text-secondary">Tax documents available</span>
        </div>
      </div>

      <EnhancedAppleCard variant="elevated" hoverEffect="subtle">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                <FileText className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="font-semibold text-text-primary">Recent Transactions</h3>
                <p className="text-sm text-text-secondary">Invoices and payment records</p>
              </div>
            </div>
            {!isTrialOrExpired && (
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export All
              </Button>
            )}
          </div>

          {isTrialOrExpired ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-surface-secondary rounded-full flex items-center justify-center mx-auto mb-4">
                <Receipt className="h-8 w-8 text-text-secondary" />
              </div>
              <h4 className="font-medium text-text-primary mb-2">No billing history yet</h4>
              <p className="text-sm text-text-secondary">
                {subscription?.plan === 'free_trial' 
                  ? "Your billing history will appear here after your first payment"
                  : "Subscribe to a plan to see your billing history"
                }
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {mockBillingHistory.map((invoice, index) => (
                <EnhancedAppleCard 
                  key={invoice.id} 
                  variant="interactive" 
                  surface="secondary" 
                  hoverEffect="subtle"
                  animated={true}
                  staggerDelay={index * 100}
                  className="group"
                >
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="p-2 bg-surface-tertiary rounded-lg group-hover:bg-primary/10 transition-colors">
                          <CreditCard className="h-4 w-4 text-text-secondary group-hover:text-primary" />
                        </div>
                        <div>
                          <div className="font-semibold text-text-primary">{invoice.description}</div>
                          <div className="flex items-center text-sm text-text-secondary mt-1">
                            <Calendar className="h-3 w-3 mr-1" />
                            {new Date(invoice.date).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <div className="font-bold text-lg text-text-primary">{invoice.amount}</div>
                          <Badge 
                            variant={invoice.status === 'paid' ? 'default' : 'secondary'} 
                            className={`text-xs ${invoice.status === 'paid' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300' : ''}`}
                          >
                            {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                          </Badge>
                        </div>
                        
                        <div className="flex space-x-2">
                          <Button variant="outline" size="sm" className="hover:bg-primary/10">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm" className="hover:bg-primary/10">
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </EnhancedAppleCard>
              ))}
              
              {mockBillingHistory.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-sm text-text-secondary">No invoices yet</p>
                </div>
              )}

              {mockBillingHistory.length > 0 && (
                <div className="pt-6 mt-6 border-t border-border-subtle">
                  <Button variant="outline" className="w-full hover:bg-primary/5">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View All Transactions
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </EnhancedAppleCard>
    </div>
  );
};