import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePersonaCustomerCounts } from '@/hooks/usePersonaCustomerCounts';
import { useAllPersonas } from '@/hooks/useAllPersonas';

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
}));

// Mock dependencies
vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({ user: { id: 'user-1' } }))
}));

vi.mock('@/hooks/useTenant', () => ({
  useTenant: vi.fn(() => ({ tenant: { id: 'tenant-1' } }))
}));

vi.mock('@/hooks/useAllPersonas');

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: fromMock.mockImplementation(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          is: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      }))
    }))
  }
}));

const customerQuery = (data, error = null) => ({
  select: vi.fn(() => ({
    eq: vi.fn(() => ({
      is: vi.fn(() => Promise.resolve({ data, error })),
    })),
  })),
});

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('contactsStore persona counts integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('correctly counts customers by persona_id (unified approach)', async () => {
    // Mock personas data
    const mockPersonas = [
      { id: 'persona-1', persona_name: 'Plant Lover', is_custom: false },
      { id: 'persona-2', persona_name: 'Garden Expert', is_custom: true }
    ];

    // Mock customers data with persona_id assignments
    const mockCustomers = [
      { id: 'customer-1', persona_id: 'persona-1', persona: null },
      { id: 'customer-2', persona_id: 'persona-1', persona: null },
      { id: 'customer-3', persona_id: 'persona-2', persona: null },
      { id: 'customer-4', persona_id: null, persona: 'Plant Lover' }, // Legacy format
    ];

    // Mock the personas hook
    vi.mocked(useAllPersonas).mockReturnValue({
      personas: mockPersonas,
      loading: false,
      predefinedPersonas: [],
      customPersonas: []
    });

    // Mock Supabase response
    fromMock.mockReturnValue(customerQuery(mockCustomers));

    const wrapper = createWrapper();
    const { result } = renderHook(() => usePersonaCustomerCounts(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Verify counts are calculated correctly
    const expectedCounts = {
      'persona-1': 3, // 2 from persona_id + 1 from legacy persona field
      'persona-2': 1
    };

    expect(result.current.counts).toEqual(expectedCounts);
  });

  it('handles mixed persona_id and legacy persona assignments', async () => {
    const mockPersonas = [
      { id: 'persona-1', persona_name: 'Beginner Gardener', is_custom: false },
    ];

    const mockCustomers = [
      { id: 'customer-1', persona_id: 'persona-1', persona: null },
      { id: 'customer-2', persona_id: null, persona: 'Beginner Gardener' },
      { id: 'customer-3', persona_id: null, persona: 'Unknown Persona' }, // Should be ignored
    ];

    vi.mocked(useAllPersonas).mockReturnValue({
      personas: mockPersonas,
      loading: false,
      predefinedPersonas: [],
      customPersonas: []
    });

    fromMock.mockReturnValue(customerQuery(mockCustomers));

    const wrapper = createWrapper();
    const { result } = renderHook(() => usePersonaCustomerCounts(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Should count both persona_id and matching legacy persona
    expect(result.current.counts['persona-1']).toBe(2);
  });

  it('retains counts for orphaned assignments after a persona is removed', async () => {
    const mockPersonas = [
      { id: 'persona-1', persona_name: 'Test Persona', is_custom: true }
    ];

    const mockCustomers = [
      { id: 'customer-1', persona_id: 'persona-1', persona: null }
    ];

    vi.mocked(useAllPersonas).mockReturnValue({
      personas: mockPersonas,
      loading: false,
      predefinedPersonas: [],
      customPersonas: mockPersonas
    });

    fromMock.mockReturnValue(customerQuery(mockCustomers));

    const wrapper = createWrapper();
    const { result, unmount } = renderHook(() => usePersonaCustomerCounts(), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.counts['persona-1']).toBe(1);

    // Simulate persona being removed
    vi.mocked(useAllPersonas).mockReturnValue({
      personas: [],
      loading: false,
      predefinedPersonas: [],
      customPersonas: []
    });

    unmount();
    const { result: refreshedResult } = renderHook(
      () => usePersonaCustomerCounts(),
      { wrapper },
    );

    await waitFor(() => {
      expect(refreshedResult.current.counts['persona-1']).toBe(1);
    });
  });

  it('handles database errors gracefully', async () => {
    vi.mocked(useAllPersonas).mockReturnValue({
      personas: [],
      loading: false,
      predefinedPersonas: [],
      customPersonas: []
    });

    // Mock database error
    fromMock.mockReturnValue(
      customerQuery(null, new Error('Database connection failed')),
    );

    const wrapper = createWrapper();
    const { result } = renderHook(() => usePersonaCustomerCounts(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Should return empty counts on error
    expect(result.current.counts).toEqual({});
  });
});
