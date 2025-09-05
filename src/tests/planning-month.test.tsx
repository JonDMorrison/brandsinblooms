import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MonthPicker } from '@/components/plan/MonthPicker';
import { QuickChips } from '@/components/plan/QuickChips';
import { format, startOfMonth, addMonths } from 'date-fns';
import { vi } from 'vitest';

const createTestWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('MonthPicker', () => {
  it('should display selected month and allow changes', () => {
    const mockOnChange = vi.fn();
    const testDate = new Date(2025, 8, 1); // September 2025
    
    render(
      <MonthPicker value={testDate} onChange={mockOnChange} />,
      { wrapper: createTestWrapper() }
    );

    expect(screen.getByText('September 2025')).toBeInTheDocument();
  });

  it('should open popover when clicked', async () => {
    const mockOnChange = vi.fn();
    const testDate = new Date(2025, 8, 1);
    
    render(
      <MonthPicker value={testDate} onChange={mockOnChange} />,
      { wrapper: createTestWrapper() }
    );

    // Click to open popover
    fireEvent.click(screen.getByText('September 2025'));
    
    // Should show year navigation
    expect(screen.getByText('2025')).toBeInTheDocument();
    
    // Should show Today button
    expect(screen.getByText('Today')).toBeInTheDocument();
  });
});

describe('QuickChips', () => {
  it('should render quick pick options', () => {
    const mockOnSelect = vi.fn();
    const testDate = startOfMonth(new Date());
    
    render(
      <QuickChips selectedMonth={testDate} onSelect={mockOnSelect} />,
      { wrapper: createTestWrapper() }
    );

    expect(screen.getByText('This month')).toBeInTheDocument();
    expect(screen.getByText('Next month')).toBeInTheDocument();
    expect(screen.getByText('Next quarter')).toBeInTheDocument();
  });

  it('should call onSelect when chip is clicked', () => {
    const mockOnSelect = vi.fn();
    const testDate = startOfMonth(new Date());
    
    render(
      <QuickChips selectedMonth={testDate} onSelect={mockOnSelect} />,
      { wrapper: createTestWrapper() }
    );

    fireEvent.click(screen.getByText('Next month'));
    
    expect(mockOnSelect).toHaveBeenCalledWith(
      expect.any(Date)
    );
  });

  it('should highlight selected month', () => {
    const mockOnSelect = vi.fn();
    const currentMonth = startOfMonth(new Date());
    
    render(
      <QuickChips selectedMonth={currentMonth} onSelect={mockOnSelect} />,
      { wrapper: createTestWrapper() }
    );

    const thisMonthButton = screen.getByText('This month');
    expect(thisMonthButton.closest('button')).toHaveClass('bg-primary');
  });
});