import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CRMAutomationBuilder } from '@/pages/crm/CRMAutomationBuilder';
import { useToast } from '@/hooks/use-toast';

// Mock dependencies
vi.mock('@/hooks/use-toast');
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

const mockToast = vi.fn();

describe('CRMAutomationBuilder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useToast as any).mockReturnValue({ toast: mockToast });
  });

  it('renders trigger popover with all trigger options', async () => {
    render(<CRMAutomationBuilder />);
    
    // Find and click the trigger button
    const triggerButton = screen.getByText('Select trigger type');
    fireEvent.click(triggerButton);
    
    // Verify all triggers are shown
    await waitFor(() => {
      expect(screen.getByText('Customer joins Loyalty Program')).toBeInTheDocument();
      expect(screen.getByText('First Purchase Completed')).toBeInTheDocument();
      expect(screen.getByText('Customer Birthday (SMS)')).toBeInTheDocument();
      expect(screen.getByText('Lifetime Spend > $500')).toBeInTheDocument();
      expect(screen.getByText('Abandoned Cart')).toBeInTheDocument();
      expect(screen.getByText('Product Delivered')).toBeInTheDocument();
      expect(screen.getByText('Workshop RSVP')).toBeInTheDocument();
      expect(screen.getByText('Email Opt-in')).toBeInTheDocument();
    });
  });

  it('shows template selector after selecting trigger', async () => {
    render(<CRMAutomationBuilder />);
    
    // Open trigger dropdown and select loyalty_join
    const triggerButton = screen.getByText('Select trigger type');
    fireEvent.click(triggerButton);
    
    await waitFor(() => {
      const loyaltyOption = screen.getByText('Customer joins Loyalty Program');
      fireEvent.click(loyaltyOption);
    });
    
    // Verify template selector appears
    await waitFor(() => {
      expect(screen.getByText('Choose a Template')).toBeInTheDocument();
    });
  });

  it('applies template when Use Template button is clicked', async () => {
    render(<CRMAutomationBuilder />);
    
    // Select loyalty trigger
    const triggerButton = screen.getByText('Select trigger type');
    fireEvent.click(triggerButton);
    
    await waitFor(() => {
      const loyaltyOption = screen.getByText('Customer joins Loyalty Program');
      fireEvent.click(loyaltyOption);
    });
    
    // Click Use Template on the SMS template
    await waitFor(() => {
      const useTemplateButton = screen.getByText('Use Template');
      fireEvent.click(useTemplateButton);
    });
    
    // Verify toast is called
    expect(mockToast).toHaveBeenCalledWith({
      title: "Template Applied",
      description: "1 step added to your automation.",
    });
  });

  it('disables save button when required fields are missing', () => {
    render(<CRMAutomationBuilder />);
    
    const saveButton = screen.getByText('Save Automation');
    expect(saveButton).toBeDisabled();
  });

  it('enables save button when all required fields are filled', async () => {
    render(<CRMAutomationBuilder />);
    
    // Fill automation name
    const nameInput = screen.getByLabelText('Automation Name');
    fireEvent.change(nameInput, { target: { value: 'Test Automation' } });
    
    // Select trigger and apply template
    const triggerButton = screen.getByText('Select trigger type');
    fireEvent.click(triggerButton);
    
    await waitFor(() => {
      const loyaltyOption = screen.getByText('Customer joins Loyalty Program');
      fireEvent.click(loyaltyOption);
    });
    
    await waitFor(() => {
      const useTemplateButton = screen.getByText('Use Template');
      fireEvent.click(useTemplateButton);
    });
    
    // Save button should now be enabled
    await waitFor(() => {
      const saveButton = screen.getByText('Save Automation');
      expect(saveButton).not.toBeDisabled();
    });
  });
});