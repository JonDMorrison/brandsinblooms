import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, CheckCircle, Users, ShoppingCart, Package, 
  Gift, Star, Cake, Clock, User, Heart, Sparkles,
  ArrowRight, ArrowLeft, Zap, PartyPopper
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SQUARE_QUICK_AUTOMATIONS, type QuickAutomation } from '@/lib/automation/squareQuickAutomations';

interface SquareSetupWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  merchantName?: string;
  connectionId?: string;
}

type WizardStep = 'sync' | 'overview' | 'automations' | 'complete';

interface SyncProgress {
  customers: { synced: number; total: number; status: 'pending' | 'syncing' | 'complete' | 'error' };
  sales: { synced: number; total: number; status: 'pending' | 'syncing' | 'complete' | 'error' };
  products: { synced: number; total: number; status: 'pending' | 'syncing' | 'complete' | 'error' };
}

interface SyncResults {
  customersCount: number;
  salesCount: number;
  productsCount: number;
  totalRevenue: number;
}

const ICON_MAP: Record<QuickAutomation['icon'], React.ComponentType<{ className?: string }>> = {
  gift: Gift,
  star: Star,
  cake: Cake,
  clock: Clock,
  user: User,
  heart: Heart,
};

const STEPS: { id: WizardStep; label: string }[] = [
  { id: 'sync', label: 'Sync Data' },
  { id: 'overview', label: 'Overview' },
  { id: 'automations', label: 'Automations' },
  { id: 'complete', label: 'Done' },
];

export const SquareSetupWizard = ({ 
  open, 
  onOpenChange, 
  merchantName,
  connectionId 
}: SquareSetupWizardProps) => {
  const [currentStep, setCurrentStep] = useState<WizardStep>('sync');
  const [syncProgress, setSyncProgress] = useState<SyncProgress>({
    customers: { synced: 0, total: 0, status: 'pending' },
    sales: { synced: 0, total: 0, status: 'pending' },
    products: { synced: 0, total: 0, status: 'pending' },
  });
  const [syncResults, setSyncResults] = useState<SyncResults>({
    customersCount: 0,
    salesCount: 0,
    productsCount: 0,
    totalRevenue: 0,
  });
  const [selectedAutomations, setSelectedAutomations] = useState<Set<string>>(
    new Set(SQUARE_QUICK_AUTOMATIONS.filter(a => a.recommended).map(a => a.id))
  );
  const [creatingAutomations, setCreatingAutomations] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep);

  // Start sync automatically when wizard opens
  useEffect(() => {
    if (open && currentStep === 'sync' && !isSyncing) {
      startSync();
    }
  }, [open, currentStep]);

  // Query actual counts from database
  const fetchActualCounts = async (): Promise<{ customers: number; sales: number; products: number }> => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return { customers: 0, sales: 0, products: 0 };

      const { data: user } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', userData.user.id)
        .single();

      if (!user?.tenant_id) return { customers: 0, sales: 0, products: 0 };

      const [customersResult, productsResult, salesResult] = await Promise.all([
        supabase
          .from('crm_customers')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', user.tenant_id)
          .eq('pos_source', 'square'),
        supabase
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', user.tenant_id)
          .eq('source', 'square'),
        supabase
          .from('pos_orders')
          .select('id', { count: 'exact', head: true })
          .eq('pos_connection_id', connectionId),
      ]);

      return {
        customers: customersResult.count || 0,
        sales: salesResult.count || 0,
        products: productsResult.count || 0,
      };
    } catch (error) {
      console.error('[SquareSetupWizard] Error fetching counts:', error);
      return { customers: 0, sales: 0, products: 0 };
    }
  };

  const startSync = async () => {
    setIsSyncing(true);
    setSyncProgress({
      customers: { synced: 0, total: 0, status: 'syncing' },
      sales: { synced: 0, total: 0, status: 'pending' },
      products: { synced: 0, total: 0, status: 'pending' },
    });

    try {
      // Step 1: Sync customers
      console.log('[SquareSetupWizard] Starting customer sync...');
      setSyncProgress(prev => ({ ...prev, customers: { ...prev.customers, status: 'syncing' } }));
      
      try {
        await supabase.functions.invoke('square-sync-customers');
      } catch (e) {
        console.log('[SquareSetupWizard] Customer sync call completed or timed out');
      }
      
      setSyncProgress(prev => ({
        ...prev,
        customers: { ...prev.customers, status: 'complete' },
        sales: { ...prev.sales, status: 'syncing' },
      }));

      // Step 2: Sync sales
      console.log('[SquareSetupWizard] Starting sales sync...');
      try {
        await supabase.functions.invoke('square-sync-sales');
      } catch (e) {
        console.log('[SquareSetupWizard] Sales sync call completed or timed out');
      }
      
      setSyncProgress(prev => ({
        ...prev,
        sales: { ...prev.sales, status: 'complete' },
        products: { ...prev.products, status: 'syncing' },
      }));

      // Step 3: Sync products
      console.log('[SquareSetupWizard] Starting products sync...');
      try {
        await supabase.functions.invoke('square-sync-products');
      } catch (e) {
        console.log('[SquareSetupWizard] Products sync call completed or timed out');
      }
      
      setSyncProgress(prev => ({
        ...prev,
        products: { ...prev.products, status: 'complete' },
      }));

      // Wait a moment for database writes to complete, then query actual counts
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const actualCounts = await fetchActualCounts();
      console.log('[SquareSetupWizard] Actual database counts:', actualCounts);

      setSyncResults({
        customersCount: actualCounts.customers,
        salesCount: actualCounts.sales,
        productsCount: actualCounts.products,
        totalRevenue: 0,
      });

      setSyncProgress({
        customers: { synced: actualCounts.customers, total: actualCounts.customers, status: 'complete' },
        sales: { synced: actualCounts.sales, total: actualCounts.sales, status: 'complete' },
        products: { synced: actualCounts.products, total: actualCounts.products, status: 'complete' },
      });

      const hasData = actualCounts.customers > 0 || actualCounts.sales > 0 || actualCounts.products > 0;
      
      toast({
        title: 'Sync complete!',
        description: hasData 
          ? `Imported ${actualCounts.customers} customers, ${actualCounts.sales} sales, ${actualCounts.products} products`
          : 'No data found to import. You can proceed to set up automations.',
      });
      
      // Auto-advance to overview after short delay
      setTimeout(() => {
        setCurrentStep('overview');
      }, 1500);

    } catch (error: any) {
      console.error('Sync error:', error);
      toast({
        title: 'Sync encountered issues',
        description: 'Some data may have synced. You can retry or proceed.',
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const toggleAutomation = (id: string) => {
    setSelectedAutomations(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const createSelectedAutomations = async () => {
    if (selectedAutomations.size === 0) {
      setCurrentStep('complete');
      return;
    }

    setCreatingAutomations(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const { data: user } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', userData.user.id)
        .single();

      if (!user?.tenant_id) throw new Error('No tenant found');

      const automationsToCreate = SQUARE_QUICK_AUTOMATIONS
        .filter(a => selectedAutomations.has(a.id))
        .map(a => ({
          name: a.name,
          trigger_type: a.trigger_type,
          is_active: true,
          tenant_id: user.tenant_id,
          user_id: userData.user.id,
          template_source: 'square_wizard',
          workflow_steps: JSON.stringify([{
            type: a.default_channel,
            delay: a.delay_days ? { days: a.delay_days } : null,
          }]),
        }));

      const { error } = await supabase
        .from('crm_automations')
        .insert(automationsToCreate);

      if (error) throw error;

      toast({
        title: 'Automations created',
        description: `${automationsToCreate.length} automation(s) activated`,
      });

      setCurrentStep('complete');
    } catch (error: any) {
      console.error('Error creating automations:', error);
      toast({
        title: 'Failed to create automations',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setCreatingAutomations(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    // Mark wizard as completed
    if (connectionId) {
      supabase
        .from('square_connections')
        .update({ setup_wizard_completed_at: new Date().toISOString() })
        .eq('id', connectionId)
        .then(() => {});
    }
  };

  const goNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex].id);
    }
  };

  const goBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex].id);
    }
  };

  const renderSyncStep = () => (
    <div className="space-y-6 py-4">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
          <Zap className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-xl font-semibold">Syncing Your Data</h3>
        <p className="text-muted-foreground">
          We're importing your customers, sales, and products from Square.
        </p>
      </div>

      <div className="space-y-4">
        {/* Customers */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span>Customers</span>
            </div>
            <span className="text-muted-foreground">
              {syncProgress.customers.status === 'complete' 
                ? <CheckCircle className="h-4 w-4 text-green-500" />
                : syncProgress.customers.status === 'syncing'
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : null
              }
            </span>
          </div>
          <Progress 
            value={syncProgress.customers.status === 'complete' ? 100 : syncProgress.customers.status === 'syncing' ? 50 : 0} 
            className="h-2"
          />
        </div>

        {/* Sales */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              <span>Sales History</span>
            </div>
            <span className="text-muted-foreground">
              {syncProgress.sales.status === 'complete' 
                ? <CheckCircle className="h-4 w-4 text-green-500" />
                : syncProgress.sales.status === 'syncing'
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : null
              }
            </span>
          </div>
          <Progress 
            value={syncProgress.sales.status === 'complete' ? 100 : syncProgress.sales.status === 'syncing' ? 50 : 0} 
            className="h-2"
          />
        </div>

        {/* Products */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span>Products</span>
            </div>
            <span className="text-muted-foreground">
              {syncProgress.products.status === 'complete' 
                ? <CheckCircle className="h-4 w-4 text-green-500" />
                : syncProgress.products.status === 'syncing'
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : null
              }
            </span>
          </div>
          <Progress 
            value={syncProgress.products.status === 'complete' ? 100 : syncProgress.products.status === 'syncing' ? 50 : 0} 
            className="h-2"
          />
        </div>
      </div>

      {syncProgress.customers.status === 'error' && (
        <Button onClick={startSync} variant="outline" className="w-full">
          Retry Sync
        </Button>
      )}
    </div>
  );

  const renderOverviewStep = () => (
    <div className="space-y-6 py-4">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
          <CheckCircle className="h-8 w-8 text-green-600" />
        </div>
        <h3 className="text-xl font-semibold">Import Complete!</h3>
        <p className="text-muted-foreground">
          Here's what we found in your Square account.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 text-center">
          <Users className="h-6 w-6 mx-auto mb-2 text-primary" />
          <div className="text-2xl font-bold">{syncResults.customersCount}</div>
          <div className="text-xs text-muted-foreground">Customers</div>
        </Card>
        <Card className="p-4 text-center">
          <ShoppingCart className="h-6 w-6 mx-auto mb-2 text-primary" />
          <div className="text-2xl font-bold">{syncResults.salesCount}</div>
          <div className="text-xs text-muted-foreground">Sales</div>
        </Card>
        <Card className="p-4 text-center">
          <Package className="h-6 w-6 mx-auto mb-2 text-primary" />
          <div className="text-2xl font-bold">{syncResults.productsCount}</div>
          <div className="text-xs text-muted-foreground">Products</div>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={goNext}>
          Set Up Automations
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );

  const renderAutomationsStep = () => (
    <div className="space-y-6 py-4">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
          <Sparkles className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-xl font-semibold">Quick Automations</h3>
        <p className="text-muted-foreground">
          Enable automated campaigns to engage your customers.
        </p>
      </div>

      <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
        {SQUARE_QUICK_AUTOMATIONS.map((automation) => {
          const IconComponent = ICON_MAP[automation.icon];
          const isSelected = selectedAutomations.has(automation.id);
          
          return (
            <Card 
              key={automation.id}
              className={cn(
                "p-4 cursor-pointer transition-all hover:shadow-md",
                isSelected && "ring-2 ring-primary bg-primary/5"
              )}
              onClick={() => toggleAutomation(automation.id)}
            >
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center",
                  isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                )}>
                  <IconComponent className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium truncate">{automation.name}</h4>
                    {automation.recommended && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                        Recommended
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {automation.description}
                  </p>
                </div>
                <Switch 
                  checked={isSelected}
                  onCheckedChange={() => toggleAutomation(automation.id)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </Card>
          );
        })}
      </div>

      <div className="flex justify-between">
        <Button variant="ghost" onClick={goBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button onClick={createSelectedAutomations} disabled={creatingAutomations}>
          {creatingAutomations ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Creating...
            </>
          ) : selectedAutomations.size > 0 ? (
            <>
              Activate {selectedAutomations.size} Automation{selectedAutomations.size > 1 ? 's' : ''}
              <ArrowRight className="h-4 w-4 ml-2" />
            </>
          ) : (
            <>
              Skip
              <ArrowRight className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );

  const renderCompleteStep = () => (
    <div className="space-y-6 py-4 text-center">
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 mb-4 animate-bounce">
        <PartyPopper className="h-10 w-10 text-green-600" />
      </div>
      
      <div className="space-y-2">
        <h3 className="text-2xl font-bold">You're All Set! 🎉</h3>
        <p className="text-muted-foreground">
          Your Square integration is ready to go.
        </p>
      </div>

      <div className="bg-muted/50 rounded-lg p-4 text-left space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <span>{syncResults.customersCount} customers synced</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <span>{syncResults.salesCount} sales imported</span>
        </div>
        {selectedAutomations.size > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span>{selectedAutomations.size} automation{selectedAutomations.size > 1 ? 's' : ''} activated</span>
          </div>
        )}
      </div>

      <Button onClick={handleClose} className="w-full" size="lg">
        Get Started
      </Button>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogTitle className="sr-only">Square Setup Wizard</DialogTitle>
        
        {/* Progress indicator */}
        <div className="flex items-center justify-between mb-6">
          {STEPS.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                index <= currentStepIndex 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-muted text-muted-foreground"
              )}>
                {index < currentStepIndex ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  index + 1
                )}
              </div>
              {index < STEPS.length - 1 && (
                <div className={cn(
                  "w-12 sm:w-16 h-1 mx-1",
                  index < currentStepIndex ? "bg-primary" : "bg-muted"
                )} />
              )}
            </div>
          ))}
        </div>

        {/* Merchant name */}
        {merchantName && currentStep === 'sync' && (
          <div className="text-center text-sm text-muted-foreground mb-4">
            Connected to <span className="font-medium text-foreground">{merchantName}</span>
          </div>
        )}

        {/* Step content */}
        {currentStep === 'sync' && renderSyncStep()}
        {currentStep === 'overview' && renderOverviewStep()}
        {currentStep === 'automations' && renderAutomationsStep()}
        {currentStep === 'complete' && renderCompleteStep()}
      </DialogContent>
    </Dialog>
  );
};
