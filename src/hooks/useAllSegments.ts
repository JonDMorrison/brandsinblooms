import { useMemo } from 'react';
import { useCRMSegments } from './useCRMSegments';

// Predefined segments that match those in CRMSegmentsPage
const predefinedSegments = [
  {
    id: 'loyalty-members',
    name: 'Loyalty Members',
    description: 'Customers enrolled in your loyalty program with active engagement',
    customer_count: 0, // TODO: Calculate actual count
  },
  {
    id: 'high-value',
    name: 'High-Value Customers',
    description: 'Top spending customers who drive significant revenue',
    customer_count: 0, // TODO: Calculate actual count
  },
  {
    id: 'new-customers',
    name: 'New Customers',
    description: 'Recent customers who made their first purchase within 30 days',
    customer_count: 0, // TODO: Calculate actual count
  },
  {
    id: 'lapsed-customers',
    name: 'Lapsed Customers',
    description: 'Previously active customers who haven\'t purchased in 90+ days',
    customer_count: 0, // TODO: Calculate actual count
  },
  {
    id: 'seasonal-shoppers',
    name: 'Seasonal Shoppers',
    description: 'Customers who typically purchase during specific seasons or holidays',
    customer_count: 0, // TODO: Calculate actual count
  },
  {
    id: 'frequent-buyers',
    name: 'Frequent Buyers',
    description: 'Customers with 3+ purchases in the last 6 months',
    customer_count: 0, // TODO: Calculate actual count
  },
];

interface Segment {
  id: string;
  name: string;
  description?: string;
  customer_count: number;
}

export const useAllSegments = () => {
  const { segments: customSegments, loading } = useCRMSegments();

  const allSegments = useMemo(() => {
    const combined: Segment[] = [
      ...predefinedSegments,
      ...customSegments
    ];
    return combined;
  }, [customSegments]);

  return {
    segments: allSegments,
    loading,
    predefinedSegments,
    customSegments
  };
};