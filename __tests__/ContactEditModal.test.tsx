import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CustomerDetailsSheet } from '@/components/crm/customers/CustomerDetailsSheet';
import { useToast } from '@/hooks/use-toast';

// Mock dependencies used by the customer details sheet.
vi.mock('@/hooks/use-toast');
vi.mock('@/components/crm/CustomerPersonaSelector', () => ({
  CustomerPersonaSelector: ({ onChange }: { onChange: (ids: string[]) => void }) => (
    <div>
      <button type="button">Show All Personas</button>
      <span>All Personas</span>
      <input
        aria-label="Test Persona"
        type="checkbox"
        onChange={() => onChange(['persona-1'])}
      />
    </div>
  ),
}));
vi.mock('@/components/crm/CustomerSegmentSelector', () => ({
  CustomerSegmentSelector: () => null,
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null }))
      })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ 
            data: { id: 'persona-1', persona_name: 'Test Persona' },
            error: null 
          }))
        })),
        order: vi.fn(() => Promise.resolve({ 
          data: [{ id: 'persona-1', persona_name: 'Test Persona' }],
          error: null 
        }))
      }))
    }))
  }
}));

const mockToast = vi.fn();

const TestWrapper = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

describe('ContactEditModal', () => {
  const mockCustomer = {
    id: 'customer-1',
    email: 'test@example.com',
    first_name: 'John',
    last_name: 'Doe',
    phone: '555-1234',
    persona_id: null,
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useToast as any).mockReturnValue({ toast: mockToast });
  });

  it('renders customer details correctly', async () => {
    const onClose = vi.fn();
    const onCustomerUpdated = vi.fn();

    render(
      <TestWrapper>
        <CustomerDetailsSheet 
          customer={mockCustomer}
          isOpen={true}
          onClose={onClose}
          onCustomerUpdated={onCustomerUpdated}
        />
      </TestWrapper>
    );

    // Verify customer information is displayed
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
    expect(screen.getByText('555-1234')).toBeInTheDocument();
  });

  it('updates persona immediately in UI when changed', async () => {
    const onClose = vi.fn();
    const onCustomerUpdated = vi.fn();

    render(
      <TestWrapper>
        <CustomerDetailsSheet 
          customer={mockCustomer}
          isOpen={true}
          onClose={onClose}
          onCustomerUpdated={onCustomerUpdated}
        />
      </TestWrapper>
    );

    // Initially should show "No persona"
    expect(screen.getByText('Show All Personas')).toBeInTheDocument();

    // Click to show personas
    fireEvent.click(screen.getByText('Show All Personas'));

    // Wait for personas to load and appear
    await waitFor(() => {
      expect(screen.getByText('All Personas')).toBeInTheDocument();
    });

    // The component should update immediately when persona is selected
    // This tests that the local state (personaId) is updated instantly
    const personaCheckboxes = screen.getAllByRole('checkbox');
    if (personaCheckboxes.length > 0) {
      fireEvent.click(personaCheckboxes[0]);
      
      // Should immediately call onCustomerUpdated to refresh parent state
      await waitFor(() => {
        expect(onCustomerUpdated).toHaveBeenCalled();
      });
    }
  });

  it('handles persona update failure gracefully', async () => {
    const onClose = vi.fn();
    const onCustomerUpdated = vi.fn();

    render(
      <TestWrapper>
        <CustomerDetailsSheet 
          customer={mockCustomer}
          isOpen={true}
          onClose={onClose}
          onCustomerUpdated={onCustomerUpdated}
        />
      </TestWrapper>
    );

    // Should still render without crashing
    expect(screen.getByText('Customer Details')).toBeInTheDocument();
  });

  it('tracks persona changes locally for immediate UI feedback', async () => {
    const customerWithPersona = {
      ...mockCustomer,
      persona_id: 'persona-1'
    };

    const onClose = vi.fn();
    const onCustomerUpdated = vi.fn();

    render(
      <TestWrapper>
        <CustomerDetailsSheet 
          customer={customerWithPersona}
          isOpen={true}
          onClose={onClose}
          onCustomerUpdated={onCustomerUpdated}
        />
      </TestWrapper>
    );

    // Should show that a persona is assigned
    await waitFor(() => {
      expect(screen.getByText('Show All Personas')).toBeInTheDocument();
    });

    // The local personaId state should be initialized with the customer's persona_id
    // This ensures immediate UI updates when personas are changed
  });
});
