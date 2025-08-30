import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { OnboardingGuard } from '@/components/OnboardingGuard';

// Mock all the contexts
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn()
}));

vi.mock('@/contexts/OnboardingStatusContext', () => ({
  useOnboardingStatus: vi.fn()
}));

vi.mock('@/contexts/LoadingContext', () => ({
  useLoading: vi.fn()
}));

const mockUseAuth = vi.mocked(require('@/contexts/AuthContext').useAuth);
const mockUseOnboardingStatus = vi.mocked(require('@/contexts/OnboardingStatusContext').useOnboardingStatus);
const mockUseLoading = vi.mocked(require('@/contexts/LoadingContext').useLoading);

describe('OnboardingGuard Hooks Order Regression Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Clear session storage
    sessionStorage.clear();
    
    // Mock loading context
    mockUseLoading.mockReturnValue({
      setLoading: vi.fn(),
      clearLoading: vi.fn()
    });
  });

  it('should not violate hooks order when user is null initially then becomes available', () => {
    const TestComponent = () => <div data-testid="test-children">Test Children</div>;
    
    // First render - no user (simulates initial auth loading state)
    mockUseAuth.mockReturnValue({
      user: null,
      loading: true
    });
    
    mockUseOnboardingStatus.mockReturnValue({
      isCompleted: false,
      hasEverCompleted: false,
      isLoading: true,
      error: null
    });

    const { rerender } = render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <OnboardingGuard>
          <TestComponent />
        </OnboardingGuard>
      </MemoryRouter>
    );

    // Second render - user becomes available (simulates successful login)
    mockUseAuth.mockReturnValue({
      user: { id: 'test-user', email: 'test@example.com' },
      loading: false
    });
    
    mockUseOnboardingStatus.mockReturnValue({
      isCompleted: true,
      hasEverCompleted: true,
      isLoading: false,
      error: null
    });

    // This should NOT throw "Rendered more hooks than during the previous render"
    expect(() => {
      rerender(
        <MemoryRouter initialEntries={['/dashboard']}>
          <OnboardingGuard>
            <TestComponent />
          </OnboardingGuard>
        </MemoryRouter>
      );
    }).not.toThrow();

    // Should render children successfully
    expect(screen.getByTestId('test-children')).toBeInTheDocument();
  });

  it('should not violate hooks order when transitioning from loading to error state', () => {
    const TestComponent = () => <div data-testid="test-children">Test Children</div>;
    
    // First render - loading state
    mockUseAuth.mockReturnValue({
      user: { id: 'test-user', email: 'test@example.com' },
      loading: false
    });
    
    mockUseOnboardingStatus.mockReturnValue({
      isCompleted: false,
      hasEverCompleted: false,
      isLoading: true,
      error: null
    });

    const { rerender } = render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <OnboardingGuard>
          <TestComponent />
        </OnboardingGuard>
      </MemoryRouter>
    );

    // Second render - error state
    mockUseOnboardingStatus.mockReturnValue({
      isCompleted: false,
      hasEverCompleted: false,
      isLoading: false,
      error: 'Failed to load onboarding status'
    });

    // This should NOT throw hooks order violation
    expect(() => {
      rerender(
        <MemoryRouter initialEntries={['/dashboard']}>
          <OnboardingGuard>
            <TestComponent />
          </OnboardingGuard>
        </MemoryRouter>
      );
    }).not.toThrow();

    // Should render children when there's an error (graceful degradation)
    expect(screen.getByTestId('test-children')).toBeInTheDocument();
  });

  it('should maintain consistent hook calls across multiple re-renders', () => {
    const TestComponent = () => <div data-testid="test-children">Test Children</div>;
    
    // Setup consistent mocks
    mockUseAuth.mockReturnValue({
      user: { id: 'test-user', email: 'test@example.com' },
      loading: false
    });
    
    mockUseOnboardingStatus.mockReturnValue({
      isCompleted: true,
      hasEverCompleted: true,
      isLoading: false,
      error: null
    });

    const { rerender } = render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <OnboardingGuard>
          <TestComponent />
        </OnboardingGuard>
      </MemoryRouter>
    );

    // Multiple re-renders should not cause hooks order issues
    for (let i = 0; i < 5; i++) {
      expect(() => {
        rerender(
          <MemoryRouter initialEntries={['/dashboard']}>
            <OnboardingGuard>
              <TestComponent />
            </OnboardingGuard>
          </MemoryRouter>
        );
      }).not.toThrow();
    }

    expect(screen.getByTestId('test-children')).toBeInTheDocument();
  });
});