import { render } from '@testing-library/react';
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { expect, it, describe, beforeEach, vi } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import '@testing-library/jest-dom';
import { CRMAutomationBuilder } from '../crm/CRMAutomationBuilder';

expect.extend(toHaveNoViolations);

// Mock the toast hook
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast })
}));

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn()
    },
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn()
        }))
      }))
    }))
  }
}));

describe('CRMAutomationBuilder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockToast.mockClear();
  });

  it('shows trigger items', async () => {
    const user = userEvent.setup();
    render(<CRMAutomationBuilder />);
    
    // Click the select trigger button
    const triggerButton = screen.getByLabelText(/select trigger/i);
    await user.click(triggerButton);
    
    // Check that we can see the loyalty program option
    expect(await screen.findByText(/Loyalty Program/i)).toBeVisible();
  });

  it('applies template when trigger is selected', async () => {
    const user = userEvent.setup();
    render(<CRMAutomationBuilder />);
    
    // Click the select trigger button
    const triggerButton = screen.getByLabelText(/select trigger/i);
    await user.click(triggerButton);
    
    // Select loyalty join trigger
    const loyaltyOption = await screen.findByText(/Loyalty Program Sign-up/i);
    await user.click(loyaltyOption);
    
    // Check that template card appears
    expect(await screen.findByText(/Instant Loyalty SMS/i)).toBeVisible();
  });

  it('has no accessibility violations when dropdown is open', async () => {
    const user = userEvent.setup();
    
    const { container } = render(<CRMAutomationBuilder />);
    
    // Click the select trigger to open dropdown
    const trigger = screen.getByLabelText(/select trigger/i);
    await user.click(trigger);
    
    // Wait for dropdown to be fully rendered
    await screen.findByText(/Loyalty Program Sign-up/i);
    
    // Check for accessibility violations
    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });
});