import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { OnboardingGuard } from '@/components/OnboardingGuard';
import { useAuth } from '@/contexts/AuthContext';
import { useOnboardingStatus } from '@/contexts/OnboardingStatusContext';
import { useLoading } from '@/contexts/LoadingContext';
import type { User } from '@supabase/supabase-js';

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

const mockUseAuth = vi.mocked(useAuth);
const mockUseOnboardingStatus = vi.mocked(useOnboardingStatus);
const mockUseLoading = vi.mocked(useLoading);

type AuthValue = ReturnType<typeof useAuth>;
type OnboardingStatusValue = ReturnType<typeof useOnboardingStatus>;
type LoadingValue = ReturnType<typeof useLoading>;

const testUser: User = {
  id: 'test-user',
  email: 'test@example.com',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: '2024-01-01T00:00:00.000Z',
};

const authValue = (overrides: Pick<AuthValue, 'user' | 'loading'>): AuthValue => ({
  session: null,
  isAuthenticated: overrides.user !== null,
  isRecoveryMode: false,
  authError: null,
  isInLimboState: false,
  signOut: vi.fn(),
  forceReset: vi.fn(),
  clearRecoveryMode: vi.fn(),
  ...overrides,
});

const onboardingStatusValue = (
  overrides: Pick<OnboardingStatusValue, 'isCompleted' | 'hasEverCompleted' | 'isLoading' | 'error'>,
): OnboardingStatusValue => ({
  refreshStatus: vi.fn(),
  markAsCompleted: vi.fn(),
  ...overrides,
});

const loadingValue = (): LoadingValue => ({
  currentLoading: null,
  setLoading: vi.fn(),
  clearLoading: vi.fn(),
  isAnyLoading: false,
});

describe('OnboardingGuard Hooks Order Regression Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Clear session storage
    sessionStorage.clear();
    
    // Mock loading context
    mockUseLoading.mockReturnValue(loadingValue());
  });

  it('should not violate hooks order when user is null initially then becomes available', () => {
    const TestComponent = () => <div data-testid="test-children">Test Children</div>;
    
    // First render - no user (simulates initial auth loading state)
    mockUseAuth.mockReturnValue(authValue({
      user: null,
      loading: true
    }));
    
    mockUseOnboardingStatus.mockReturnValue(onboardingStatusValue({
      isCompleted: false,
      hasEverCompleted: false,
      isLoading: true,
      error: null
    }));

    const { rerender } = render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <OnboardingGuard>
          <TestComponent />
        </OnboardingGuard>
      </MemoryRouter>
    );

    // Second render - user becomes available (simulates successful login)
    mockUseAuth.mockReturnValue(authValue({
      user: testUser,
      loading: false
    }));
    
    mockUseOnboardingStatus.mockReturnValue(onboardingStatusValue({
      isCompleted: true,
      hasEverCompleted: true,
      isLoading: false,
      error: null
    }));

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
    mockUseAuth.mockReturnValue(authValue({
      user: testUser,
      loading: false
    }));
    
    mockUseOnboardingStatus.mockReturnValue(onboardingStatusValue({
      isCompleted: false,
      hasEverCompleted: false,
      isLoading: true,
      error: null
    }));

    const { rerender } = render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <OnboardingGuard>
          <TestComponent />
        </OnboardingGuard>
      </MemoryRouter>
    );

    // Second render - error state
    mockUseOnboardingStatus.mockReturnValue(onboardingStatusValue({
      isCompleted: false,
      hasEverCompleted: false,
      isLoading: false,
      error: 'Failed to load onboarding status'
    }));

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
    mockUseAuth.mockReturnValue(authValue({
      user: testUser,
      loading: false
    }));
    
    mockUseOnboardingStatus.mockReturnValue(onboardingStatusValue({
      isCompleted: true,
      hasEverCompleted: true,
      isLoading: false,
      error: null
    }));

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
