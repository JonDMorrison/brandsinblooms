import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoyaltyProgrammePlanner } from './LoyaltyProgrammePlanner';
const mocks = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }));
beforeEach(() => vi.clearAllMocks());
const props = { tenantId: 'tenant-a', timezone: 'America/Vancouver' };
async function open() { fireEvent.click(screen.getByRole('button', { name: /Loyalty programme planner/ })); await screen.findByText('Give customers a reason to return.'); }
describe('LoyaltyProgrammePlanner', () => {
  it('offers only review and export, not live issuance or sending', async () => {
    render(<LoyaltyProgrammePlanner {...props} />); await open();
    expect(screen.getByText(/does not issue rewards, authorize discounts/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Export draft' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: /^(Activate|Send|Issue|Launch)/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Review draft with Bloom' }));
    const target = mocks.navigate.mock.calls[0][0] as string;
    expect(target).toMatch(/^\/bloom\?prompt=/);
    expect(decodeURIComponent(target)).toContain('Do not issue benefits');
  });
  it('previews an explicit fictional basket and invalidates it after edits', async () => {
    render(<LoyaltyProgrammePlanner {...props} />); await open();
    fireEvent.click(screen.getByRole('button', { name: 'Preview fictional basket' }));
    expect(await screen.findByText('Example meets the planning rules')).toBeVisible();
    fireEvent.change(screen.getByLabelText('Minimum eligible merchandise spend'), { target: { value: '500.00' } });
    expect(screen.queryByText('Example meets the planning rules')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Preview fictional basket' }));
    expect(await screen.findByText('Example does not qualify')).toBeVisible();
  });
  it('blocks invalid inputs without silently coercing a blank amount to zero', async () => {
    render(<LoyaltyProgrammePlanner {...props} />); await open();
    fireEvent.change(screen.getByLabelText('Voucher amount'), { target: { value: '' } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Export draft' })).toBeDisabled());
    expect(screen.getByRole('button', { name: 'Review draft with Bloom' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Preview fictional basket' })).toBeDisabled();
  });
  it('does not reuse another company’s draft', async () => {
    const view = render(<LoyaltyProgrammePlanner {...props} />); await open();
    fireEvent.change(screen.getByLabelText('Programme name'), { target: { value: 'Private draft for A' } });
    view.rerender(<LoyaltyProgrammePlanner {...props} tenantId="tenant-b" />); await open();
    expect(screen.getByLabelText('Programme name')).toHaveValue('Welcome & second visit');
    expect(screen.queryByDisplayValue('Private draft for A')).not.toBeInTheDocument();
  });
});
