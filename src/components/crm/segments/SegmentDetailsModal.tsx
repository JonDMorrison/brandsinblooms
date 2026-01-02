import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Users, Target, Search, Plus, X, Loader2, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { EnhancedSegmentImportDialog } from './EnhancedSegmentImportDialog';
import { usePaginatedCustomers } from '@/hooks/usePaginatedCustomers';
import { LazyCustomerList } from '@/components/shared/LazyCustomerList';

interface Customer {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  total_spent?: number;
}

interface Segment {
  id: string;
  name: string;
  description?: string;
  conditions: any;
  customer_count: number;
  auto_update: boolean;
  created_at: string;
}

interface SegmentDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  segment: Segment | null;
  onSegmentUpdate?: () => void;
}

export const SegmentDetailsModal: React.FC<SegmentDetailsModalProps> = ({
  open,
  onOpenChange,
  segment,
  onSegmentUpdate
}) => {
  const [assignedSearchTerm, setAssignedSearchTerm] = useState('');
  const [availableSearchTerm, setAvailableSearchTerm] = useState('');
  const [loadingCustomerId, setLoadingCustomerId] = useState<string | null>(null);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [tenantId, setTenantId] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const { toast } = useToast();

  const isCustomSegment = segment?.id ? segment.id.length > 10 : false;

  // Lazy loaded customers in segment
  const {
    customers: segmentCustomers,
    isLoading: segmentLoading,
    isFetchingNextPage: segmentFetchingMore,
    hasNextPage: hasMoreSegmentCustomers,
    fetchNextPage: loadMoreSegmentCustomers,
    totalCount: segmentTotalCount,
    refetch: refetchSegmentCustomers,
    isSearching: isSearchingSegment,
  } = usePaginatedCustomers({
    segmentId: isCustomSegment ? segment?.id : undefined,
    searchTerm: assignedSearchTerm,
    pageSize: 25,
    enabled: open && !!segment && isCustomSegment,
  });

  // Lazy loaded available customers (not in segment)
  const {
    customers: availableCustomers,
    isLoading: availableLoading,
    isFetchingNextPage: availableFetchingMore,
    hasNextPage: hasMoreAvailable,
    fetchNextPage: loadMoreAvailable,
    totalCount: availableTotalCount,
    refetch: refetchAvailableCustomers,
    isSearching: isSearchingAvailable,
  } = usePaginatedCustomers({
    excludeSegmentId: isCustomSegment ? segment?.id : undefined,
    searchTerm: availableSearchTerm,
    pageSize: 25,
    enabled: open && !!segment && isCustomSegment,
  });

  useEffect(() => {
    const fetchUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        const { data: userData } = await supabase
          .from('users')
          .select('tenant_id')
          .eq('id', user.id)
          .single();
        if (userData) {
          setTenantId(userData.tenant_id);
        }
      }
    };
    fetchUserData();
  }, []);

  // Reset search when dialog closes
  useEffect(() => {
    if (!open) {
      setAssignedSearchTerm('');
      setAvailableSearchTerm('');
    }
  }, [open]);

  const addCustomerToSegment = async (customerId: string) => {
    if (!segment || loadingCustomerId || !isCustomSegment) return;

    setLoadingCustomerId(customerId);

    try {
      const { error } = await supabase
        .from('customer_segments')
        .insert({
          customer_id: customerId,
          segment_id: segment.id
        });

      if (error) throw error;

      // Refetch both lists to update counts
      refetchSegmentCustomers();
      refetchAvailableCustomers();

    } catch (error) {
      console.error('Error adding customer:', error);
    } finally {
      setLoadingCustomerId(null);
    }
  };

  const removeCustomerFromSegment = async (customerId: string) => {
    if (!segment || loadingCustomerId || !isCustomSegment) return;

    setLoadingCustomerId(customerId);

    try {
      const { error } = await supabase
        .from('customer_segments')
        .delete()
        .eq('customer_id', customerId)
        .eq('segment_id', segment.id);

      if (error) throw error;

      // Refetch both lists to update counts
      refetchSegmentCustomers();
      refetchAvailableCustomers();

    } catch (error) {
      console.error('Error removing customer:', error);
    } finally {
      setLoadingCustomerId(null);
    }
  };

  const bulkAddCustomers = async (customerIds: string[]) => {
    if (!segment || customerIds.length === 0) return;

    try {
      console.log('🔄 Bulk adding', customerIds.length, 'customers to segment', segment.id);
      
      const BATCH_SIZE = 500;
      let totalAdded = 0;
      
      for (let i = 0; i < customerIds.length; i += BATCH_SIZE) {
        const batch = customerIds.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(customerIds.length / BATCH_SIZE);
        
        console.log(`📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} customers)`);
        
        const { error } = await supabase
          .from('customer_segments')
          .upsert(
            batch.map(id => ({
              customer_id: id,
              segment_id: segment.id
            })),
            { 
              onConflict: 'customer_id,segment_id',
              ignoreDuplicates: true 
            }
          );

        if (error) {
          console.error('❌ Error in batch', batchNum, ':', error);
          throw error;
        }
        
        totalAdded += batch.length;
        console.log(`✅ Batch ${batchNum}/${totalBatches} completed (${totalAdded}/${customerIds.length} total)`);
      }

      console.log('✅ Successfully bulk added all customers, refreshing data...');

      // Refresh both customer lists
      refetchSegmentCustomers();
      refetchAvailableCustomers();
      
      if (onSegmentUpdate) {
        onSegmentUpdate();
      }

      toast({
        title: "Success",
        description: `Added ${customerIds.length} customers to segment`,
      });

    } catch (error) {
      console.error('Error bulk adding customers:', error);
      toast({
        title: "Error",
        description: "Failed to add customers to segment. Please try again.",
        variant: "destructive",
      });
      throw error;
    }
  };

  if (!segment) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <Target className="h-6 w-6 text-primary" />
            <div>
              <DialogTitle className="text-xl">{segment.name}</DialogTitle>
              {segment.description && (
                <p className="text-sm text-muted-foreground mt-1">
                  {segment.description}
                </p>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Summary Section */}
          <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <span className="font-semibold">{segmentTotalCount} Customers</span>
            </div>
            {segment.auto_update && (
              <Badge variant="outline">Auto-update</Badge>
            )}
            <div className="text-xs text-muted-foreground ml-auto">
              Created {new Date(segment.created_at).toLocaleDateString()}
            </div>
          </div>

          {!isCustomSegment && (
            <div className="mb-4 p-3 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                This is a predefined segment. Customers are automatically assigned based on their purchase behavior and cannot be manually managed.
              </p>
            </div>
          )}

          {/* Two Column Layout */}
          <div className="flex-1 min-h-0">
            <div className="grid grid-cols-2 gap-6">
              {/* Left Column - Assigned Customers */}
              <div className="flex flex-col min-h-0">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Assigned Customers
                </h3>
                
                {/* Search for assigned */}
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search assigned..."
                    value={assignedSearchTerm}
                    onChange={(e) => setAssignedSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                
                <LazyCustomerList
                  customers={segmentCustomers}
                  isLoading={segmentLoading}
                  isFetchingNextPage={segmentFetchingMore}
                  hasNextPage={hasMoreSegmentCustomers}
                  onLoadMore={() => loadMoreSegmentCustomers()}
                  totalCount={segmentTotalCount}
                  emptyMessage={isCustomSegment ? "No customers assigned yet. Add from available list." : "No customers in this segment."}
                  searchTerm={assignedSearchTerm}
                  isSearching={isSearchingSegment}
                  renderCustomer={(customer) => (
                    <div className="flex items-center justify-between p-3 hover:bg-muted/50 rounded-lg mb-1">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate text-sm">{customer.email}</div>
                        <div className="text-xs text-muted-foreground">
                          {customer.first_name || customer.last_name 
                            ? `${customer.first_name || ''} ${customer.last_name || ''}`.trim()
                            : 'No name'
                          }
                          {customer.total_spent !== undefined && customer.total_spent > 0 && (
                            <span className="ml-2">• ${customer.total_spent.toFixed(2)}</span>
                          )}
                        </div>
                      </div>
                      {isCustomSegment && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            removeCustomerFromSegment(customer.id);
                          }}
                          disabled={loadingCustomerId === customer.id}
                          className="text-destructive hover:text-destructive flex-shrink-0 ml-2 h-8 w-8 p-0"
                        >
                          {loadingCustomerId === customer.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <X className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </div>
                  )}
                />
              </div>

              {/* Right Column - Available Customers */}
              <div className="flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Available Customers
                  </h3>
                  <div className="flex items-center gap-2">
                    {isCustomSegment && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowBulkImport(true)}
                        className="gap-1 h-7 text-xs"
                      >
                        <Upload className="h-3 w-3" />
                        Import
                      </Button>
                    )}
                    {!isCustomSegment && (
                      <Badge variant="secondary" className="text-xs">
                        View Only
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Search for available */}
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search available..."
                    value={availableSearchTerm}
                    onChange={(e) => setAvailableSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>

                <LazyCustomerList
                  customers={availableCustomers}
                  isLoading={availableLoading}
                  isFetchingNextPage={availableFetchingMore}
                  hasNextPage={hasMoreAvailable}
                  onLoadMore={() => loadMoreAvailable()}
                  totalCount={availableTotalCount}
                  emptyMessage="No customers available to add"
                  searchTerm={availableSearchTerm}
                  isSearching={isSearchingAvailable}
                  renderCustomer={(customer) => (
                    <div className="flex items-center justify-between p-3 hover:bg-muted/50 rounded-lg mb-1">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate text-sm">{customer.email}</div>
                        <div className="text-xs text-muted-foreground">
                          {(customer.first_name || customer.last_name) ? (
                            <span>{customer.first_name} {customer.last_name}</span>
                          ) : (
                            'No name'
                          )}
                          {customer.total_spent !== undefined && customer.total_spent > 0 && (
                            <span className="ml-2">• ${customer.total_spent.toFixed(2)}</span>
                          )}
                        </div>
                      </div>
                      {isCustomSegment && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            addCustomerToSegment(customer.id);
                          }}
                          disabled={loadingCustomerId === customer.id}
                          className="flex-shrink-0 ml-2 h-8 w-8 p-0"
                        >
                          {loadingCustomerId === customer.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Plus className="h-3 w-3" />
                          )}
                        </Button>
                      )}
                    </div>
                  )}
                />
              </div>
            </div>
          </div>
          
          {/* Close Button */}
          <div className="flex justify-end pt-4 border-t mt-4">
            <Button 
              variant="outline" 
              onClick={() => {
                console.log('Close button clicked');
                onOpenChange(false);
              }}
              className="px-6"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Bulk Import Dialog - rendered outside parent dialog */}
    <EnhancedSegmentImportDialog
      open={showBulkImport}
      onOpenChange={setShowBulkImport}
      segmentId={segment?.id}
      segmentName={segment?.name}
        onImportComplete={() => {
          refetchSegmentCustomers();
          refetchAvailableCustomers();
          if (onSegmentUpdate) {
            onSegmentUpdate();
          }
        }}
    />
  </>
  );
};