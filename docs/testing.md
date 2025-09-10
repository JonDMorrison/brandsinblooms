# Testing Documentation

## Testing Strategy Overview

Our application implements a comprehensive testing strategy with multiple layers:
- **Unit Tests**: Individual component and function testing
- **Integration Tests**: API and database interaction testing
- **End-to-End Tests**: Full user workflow testing
- **Visual Regression Tests**: UI consistency testing

## Testing Stack

### Frontend Testing
- **Test Runner**: Vitest
- **Testing Library**: @testing-library/react
- **User Events**: @testing-library/user-event
- **Mocking**: vi (Vitest mocks)
- **Assertions**: @testing-library/jest-dom

### E2E Testing
- **Framework**: Playwright
- **Browser Support**: Chromium, Firefox, WebKit
- **Accessibility**: @axe-core/playwright

### API Testing
- **Edge Functions**: Deno testing framework
- **Database**: Supabase local development

## Test Structure

```
src/
├── __tests__/           # Global test utilities
├── components/
│   └── __tests__/       # Component tests
├── hooks/
│   └── __tests__/       # Hook tests
├── lib/
│   └── __tests__/       # Utility function tests
└── pages/
    └── __tests__/       # Page component tests

tests/
├── e2e/                # End-to-end tests
├── fixtures/           # Test data and fixtures
└── utils/              # E2E test utilities
```

## Unit Testing

### Component Testing Pattern
```typescript
// src/components/__tests__/Button.test.tsx
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { Button } from '../Button';

describe('Button', () => {
  it('should render with correct text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('should call onClick when clicked', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    
    render(<Button onClick={handleClick}>Click me</Button>);
    
    await user.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should be disabled when loading', () => {
    render(<Button loading>Click me</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
```

### Hook Testing Pattern
```typescript
// src/hooks/__tests__/useAuth.test.tsx
import { renderHook, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { useAuth } from '../useAuth';
import { AuthProvider } from '@/contexts/AuthContext';

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
    }
  }
}));

describe('useAuth', () => {
  it('should return user when authenticated', async () => {
    const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;
    
    const { result } = renderHook(() => useAuth(), { wrapper });
    
    await waitFor(() => {
      expect(result.current.user).toBeDefined();
    });
  });
});
```

### Utility Function Testing
```typescript
// src/lib/__tests__/utils.test.ts
import { describe, it, expect } from 'vitest';
import { cn, formatDate, truncateText } from '../utils';

describe('cn', () => {
  it('should merge class names correctly', () => {
    expect(cn('base', 'additional')).toBe('base additional');
    expect(cn('base', { conditional: true })).toBe('base conditional');
    expect(cn('base', { conditional: false })).toBe('base');
  });
});

describe('formatDate', () => {
  it('should format date correctly', () => {
    const date = new Date('2024-01-15');
    expect(formatDate(date)).toBe('Jan 15, 2024');
  });
});
```

## Integration Testing

### API Integration Tests
```typescript
// src/__tests__/api-integration.test.ts
import { supabase } from '@/integrations/supabase/client';
import { createTestUser, cleanupTestData } from './test-utils';

describe('Content API Integration', () => {
  let testUser;

  beforeEach(async () => {
    testUser = await createTestUser();
  });

  afterEach(async () => {
    await cleanupTestData(testUser.id);
  });

  it('should create content task', async () => {
    const { data, error } = await supabase
      .from('content_tasks')
      .insert({
        user_id: testUser.id,
        title: 'Test Task',
        content_type: 'instagram_post'
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).toMatchObject({
      title: 'Test Task',
      content_type: 'instagram_post',
      status: 'draft'
    });
  });
});
```

### Database Testing
```typescript
// src/__tests__/database.test.ts
import { createClient } from '@supabase/supabase-js';

const testSupabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

describe('Database Policies', () => {
  it('should enforce RLS on content_tasks', async () => {
    // Attempt to access data without authentication
    const { data, error } = await testSupabase
      .from('content_tasks')
      .select('*');

    expect(error).toBeDefined();
    expect(error?.message).toContain('row-level security');
  });
});
```

## End-to-End Testing

### User Journey Tests
```typescript
// tests/e2e/content-creation.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Content Creation Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login with test user
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'test@example.com');
    await page.fill('[data-testid="password"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await expect(page).toHaveURL('/dashboard');
  });

  test('should create and approve content', async ({ page }) => {
    // Navigate to content creation
    await page.click('[data-testid="create-content"]');
    await expect(page).toHaveURL('/content/create');

    // Fill content form
    await page.fill('[data-testid="content-title"]', 'Test Post');
    await page.selectOption('[data-testid="content-type"]', 'instagram_post');
    await page.fill('[data-testid="content-text"]', 'This is a test post');

    // Generate content
    await page.click('[data-testid="generate-content"]');
    await expect(page.locator('[data-testid="generated-content"]')).toBeVisible();

    // Approve content
    await page.click('[data-testid="approve-content"]');
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
  });

  test('should schedule content for publishing', async ({ page }) => {
    // Create content first
    await page.goto('/content');
    await page.click('[data-testid="schedule-content"]');

    // Set schedule
    await page.fill('[data-testid="schedule-date"]', '2024-12-25');
    await page.fill('[data-testid="schedule-time"]', '10:00');
    await page.click('[data-testid="confirm-schedule"]');

    // Verify scheduling
    await expect(page.locator('[data-testid="scheduled-indicator"]')).toBeVisible();
  });
});
```

### Accessibility Testing
```typescript
// tests/e2e/accessibility.spec.ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility', () => {
  test('should not have accessibility violations on dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should be keyboard navigable', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Test tab navigation
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toBeVisible();
    
    // Test skip link
    await page.keyboard.press('Tab');
    const skipLink = page.locator('[data-testid="skip-to-content"]');
    if (await skipLink.isVisible()) {
      await page.keyboard.press('Enter');
      await expect(page.locator('main')).toBeFocused();
    }
  });
});
```

## Visual Regression Testing

### Component Visual Tests
```typescript
// tests/visual/components.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Component Visual Tests', () => {
  test('Button variants should render correctly', async ({ page }) => {
    await page.goto('/storybook/button');
    
    // Test different button variants
    const variants = ['default', 'primary', 'secondary', 'ghost'];
    
    for (const variant of variants) {
      await page.click(`[data-testid="variant-${variant}"]`);
      await expect(page.locator('[data-testid="button-preview"]')).toHaveScreenshot(`button-${variant}.png`);
    }
  });

  test('Dashboard layout should be consistent', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveScreenshot('dashboard-layout.png', {
      fullPage: true,
      mask: [page.locator('[data-testid="dynamic-content"]')]
    });
  });
});
```

## Test Data Management

### Test Fixtures
```typescript
// tests/fixtures/users.ts
export const testUsers = {
  admin: {
    email: 'admin@test.com',
    password: 'admin123',
    role: 'admin'
  },
  user: {
    email: 'user@test.com',
    password: 'user123',
    role: 'user'
  }
};

export const testContent = {
  instagramPost: {
    title: 'Test Instagram Post',
    content_type: 'instagram_post',
    generated_content: 'This is a test Instagram post with hashtags #test #content'
  },
  facebookPost: {
    title: 'Test Facebook Post',
    content_type: 'facebook_post',
    generated_content: 'This is a test Facebook post for our audience'
  }
};
```

### Test Utilities
```typescript
// tests/utils/test-helpers.ts
import { supabase } from '@/integrations/supabase/client';

export async function createTestUser(userData = {}) {
  const { data, error } = await supabase.auth.signUp({
    email: `test-${Date.now()}@example.com`,
    password: 'password123',
    ...userData
  });
  
  if (error) throw error;
  return data.user;
}

export async function cleanupTestData(userId: string) {
  await supabase.from('content_tasks').delete().eq('user_id', userId);
  await supabase.from('campaigns').delete().eq('user_id', userId);
  await supabase.auth.admin.deleteUser(userId);
}

export function mockSupabaseAuth(user = null) {
  vi.mocked(supabase.auth.getUser).mockResolvedValue({
    data: { user },
    error: null
  });
}
```

## Test Configuration

### Vitest Configuration
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    globals: true,
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/__tests__/',
        '**/*.d.ts',
        '**/*.config.*'
      ]
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  }
});
```

### Playwright Configuration
```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] }
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] }
    }
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI
  }
});
```

## Continuous Integration

### GitHub Actions Workflow
```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: 'npm'
      
      - run: npm ci
      - run: npm run test:unit
      - run: npm run test:coverage
      
      - uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: 'npm'
      
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
      
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

## Best Practices

### Writing Good Tests
1. **Test Behavior, Not Implementation**: Focus on what the user experiences
2. **Use Data Test IDs**: Reliable element selection with `data-testid`
3. **Avoid Testing Implementation Details**: Don't test internal state changes
4. **Mock External Dependencies**: Isolate units under test
5. **Write Descriptive Test Names**: Clear test purpose and expected outcome

### Test Organization
1. **Group Related Tests**: Use `describe` blocks for logical grouping
2. **One Assertion Per Test**: Keep tests focused and specific
3. **Setup and Teardown**: Proper test isolation with beforeEach/afterEach
4. **Shared Test Utilities**: Reusable helper functions
5. **Consistent Naming**: Follow naming conventions across all tests

### Performance Considerations
1. **Parallel Test Execution**: Configure workers for faster execution
2. **Test Data Cleanup**: Prevent test data accumulation
3. **Selective Test Running**: Run only affected tests during development
4. **Mocking Heavy Operations**: Mock expensive API calls and computations
5. **Test Environment Optimization**: Lightweight test environment setup

### Debugging Tests
1. **Debug Mode**: Use `test.only` and `test.skip` for focused testing
2. **Console Logging**: Strategic logging for test debugging
3. **Visual Debugging**: Screenshots and videos for E2E test failures
4. **Test Isolation**: Ensure tests don't depend on each other
5. **CI/CD Integration**: Comprehensive reporting and artifact collection