import React from 'react';
import { Button } from '@/components/ui-legacy/button';
import { ScrollArea } from '@/components/ui-legacy/scroll-area';
import { Loader2, Users, Search } from 'lucide-react';
import { PaginatedCustomer } from '@/hooks/usePaginatedCustomers';

interface LazyCustomerListProps {
  customers: PaginatedCustomer[];
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  onLoadMore: () => void;
  totalCount: number;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  searchTerm?: string;
  isSearching?: boolean;
  renderCustomer: (customer: PaginatedCustomer) => React.ReactNode;
  height?: string;
}

export const LazyCustomerList: React.FC<LazyCustomerListProps> = ({
  customers,
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  onLoadMore,
  totalCount,
  emptyMessage = 'No customers found',
  emptyIcon,
  searchTerm,
  isSearching,
  renderCustomer,
  height = 'h-[350px]'
}) => {
  if (isLoading) {
    return (
      <div className={`${height} border rounded-lg`}>
        <div className="space-y-2 p-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (customers.length === 0) {
    return (
      <div className={`${height} border rounded-lg flex items-center justify-center`}>
        <div className="text-center py-8 text-muted-foreground px-4">
          {emptyIcon || (searchTerm ? <Search className="h-8 w-8 mx-auto mb-2 opacity-50" /> : <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />)}
          <p>{searchTerm ? `No customers found for "${searchTerm}"` : emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${height} border rounded-lg flex flex-col`}>
      {/* Status bar */}
      <div className="px-3 py-2 border-b bg-muted/30 text-xs text-muted-foreground flex items-center justify-between">
        <span>
          Showing {customers.length} of {totalCount} customers
        </span>
        {isSearching && (
          <span className="flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Searching...
          </span>
        )}
      </div>

      {/* Customer list */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {customers.map(customer => (
            <React.Fragment key={customer.id}>
              {renderCustomer(customer)}
            </React.Fragment>
          ))}
          
          {/* Load more */}
          {hasNextPage && (
            <div className="pt-2 pb-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={onLoadMore}
                disabled={isFetchingNextPage}
                className="w-full text-muted-foreground"
              >
                {isFetchingNextPage ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin mr-2" />
                    Loading more...
                  </>
                ) : (
                  `Load more (${totalCount - customers.length} remaining)`
                )}
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
