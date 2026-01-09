import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useDebounce } from '@/hooks/useDebounce';
import { useMemo } from 'react';

export interface PaginatedCustomer {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  total_spent?: number;
}

interface UsePaginatedCustomersOptions {
  pageSize?: number;
  searchTerm?: string;
  segmentId?: string;           // Filter BY segment membership
  excludeSegmentId?: string;    // Exclude customers in this segment
  enabled?: boolean;
}

interface CustomerPage {
  customers: PaginatedCustomer[];
  nextCursor: number | null;
  totalCount: number;
}

/**
 * Builds an OR filter string for PostgREST that handles multi-word searches.
 * e.g. "christine theisen" will match first_name containing "christine" AND last_name containing "theisen".
 */
function buildSearchFilter(rawSearch: string, fieldPrefix = ''): string {
  const sanitized = rawSearch
    .replace(/[(),]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!sanitized) return '';

  const p = fieldPrefix; // e.g. "" or "crm_customers."
  const tokens = sanitized.split(' ').filter(Boolean);

  const orParts: string[] = [
    `${p}email.ilike.%${sanitized}%`,
    `${p}first_name.ilike.%${sanitized}%`,
    `${p}last_name.ilike.%${sanitized}%`,
  ];

  if (tokens.length > 1) {
    const first = tokens[0];
    const last = tokens[tokens.length - 1];
    orParts.push(`and(${p}first_name.ilike.%${first}%,${p}last_name.ilike.%${last}%)`);
    orParts.push(`and(${p}first_name.ilike.%${last}%,${p}last_name.ilike.%${first}%)`);

    for (const token of tokens) {
      orParts.push(`${p}email.ilike.%${token}%`);
      orParts.push(`${p}first_name.ilike.%${token}%`);
      orParts.push(`${p}last_name.ilike.%${token}%`);
    }
  }

  return orParts.join(',');
}

export const usePaginatedCustomers = (options: UsePaginatedCustomersOptions = {}) => {
  const { pageSize = 25, searchTerm = '', segmentId, excludeSegmentId, enabled = true } = options;
  const { tenant } = useTenant();
  const debouncedSearch = useDebounce(searchTerm, 300);

  const query = useInfiniteQuery<CustomerPage>({
    queryKey: ['paginated-customers', tenant?.id, debouncedSearch, segmentId, excludeSegmentId, pageSize],
    queryFn: async ({ pageParam = 0 }) => {
      if (!tenant?.id) {
        return { customers: [], nextCursor: null, totalCount: 0 };
      }

      const offset = pageParam as number;
      
      // If filtering by segment membership
      if (segmentId) {
        let query = supabase
          .from('customer_segments')
          .select(`
            customer_id,
            crm_customers!inner(id, email, first_name, last_name, phone, total_spent)
          `, { count: 'exact' })
          .eq('segment_id', segmentId)
          .eq('crm_customers.tenant_id', tenant.id)
          .order('customer_id', { ascending: true })
          .range(offset, offset + pageSize - 1);

        if (debouncedSearch) {
          const filter = buildSearchFilter(debouncedSearch, 'crm_customers.');
          if (filter) {
            query = query.or(filter);
          }
        }

        const { data, error, count } = await query;
        
        if (error) throw error;

        const customers = (data || []).map(item => item.crm_customers as unknown as PaginatedCustomer).filter(Boolean);
        const totalCount = count || 0;
        const hasMore = offset + pageSize < totalCount;

        return {
          customers,
          nextCursor: hasMore ? offset + pageSize : null,
          totalCount
        };
      }

      // If excluding customers from a segment
      let excludedIds: string[] = [];
      if (excludeSegmentId) {
        const { data: memberData } = await supabase
          .from('customer_segments')
          .select('customer_id')
          .eq('segment_id', excludeSegmentId);
        
        excludedIds = (memberData || []).map(m => m.customer_id);
      }

      // Base query for all customers
      let query = supabase
        .from('crm_customers')
        .select('id, email, first_name, last_name, phone, total_spent', { count: 'exact' })
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (debouncedSearch) {
        const filter = buildSearchFilter(debouncedSearch);
        if (filter) {
          query = query.or(filter);
        }
      }

      if (excludedIds.length > 0) {
        query = query.not('id', 'in', `(${excludedIds.join(',')})`);
      }

      const { data, error, count } = await query;
      
      if (error) throw error;

      const totalCount = count || 0;
      const hasMore = offset + pageSize < totalCount;

      return {
        customers: data || [],
        nextCursor: hasMore ? offset + pageSize : null,
        totalCount
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: 0,
    enabled: enabled && !!tenant?.id,
  });

  // Flatten all pages into a single array
  const customers = useMemo(() => {
    return query.data?.pages.flatMap(page => page.customers) || [];
  }, [query.data?.pages]);

  const totalCount = query.data?.pages[0]?.totalCount || 0;

  return {
    customers,
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    totalCount,
    refetch: query.refetch,
    isSearching: searchTerm !== debouncedSearch,
  };
};
