# Development Setup Guide

## Prerequisites

### Required Software
- **Node.js**: Version 18 or higher
- **npm**: Version 9 or higher (comes with Node.js)
- **Git**: Latest version
- **Code Editor**: VS Code recommended

### Recommended VS Code Extensions
```json
{
  "recommendations": [
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-typescript-next",
    "ms-playwright.playwright",
    "bradlc.vscode-tailwindcss",
    "usernamehw.errorlens",
    "christian-kohler.path-intellisense",
    "ms-vscode.vscode-jest"
  ]
}
```

## Local Development Setup

### 1. Clone Repository
```bash
git clone <repository-url>
cd social-media-app
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
Create `.env.local` file in the project root:
```env
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key

# Development flags
NODE_ENV=development
VITE_DEBUG_MODE=true

# Optional: Sentry (for error tracking)
VITE_SENTRY_DSN=your_sentry_dsn

# Optional: Vercel Analytics
VITE_VERCEL_ANALYTICS_ID=your_analytics_id
```

### 4. Supabase Setup
If you need to set up a local Supabase instance:
```bash
# Install Supabase CLI
npm install -g @supabase/cli

# Initialize Supabase
supabase init

# Start local Supabase
supabase start

# Run migrations
supabase db reset
```

### 5. Start Development Server
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

## Project Structure Deep Dive

```
src/
├── components/              # Reusable UI components
│   ├── ui/                 # Base UI components (shadcn/ui)
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   └── ...
│   ├── content/            # Content management components
│   │   ├── ContentGenerationCard.tsx
│   │   ├── ReviewQueue.tsx
│   │   └── ...
│   ├── analytics/          # Analytics dashboard components
│   ├── smart-time/         # AI scheduling components
│   └── homepage/           # Landing page components
├── contexts/               # React context providers
│   ├── AuthContext.tsx
│   └── TenantContext.tsx
├── hooks/                  # Custom React hooks
│   ├── useAuth.ts
│   ├── useGoogleAnalytics.ts
│   └── ...
├── lib/                    # Utility libraries
│   ├── utils.ts           # General utilities
│   ├── image/             # Image processing utilities
│   └── socialHelpers.ts   # Social media helpers
├── pages/                  # Route components
│   ├── DashboardPage.tsx
│   ├── ContentPage.tsx
│   └── ...
├── integrations/           # External service integrations
│   └── supabase/
│       ├── client.ts      # Supabase client configuration
│       └── types.ts       # Generated TypeScript types
├── styles/
│   ├── globals.css        # Global styles and CSS variables
│   └── components.css     # Component-specific styles
└── types/                  # TypeScript type definitions
    └── index.ts
```

## Development Workflow

### Git Workflow
```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Make changes and commit
git add .
git commit -m "feat: add new feature description"

# Push branch
git push origin feature/your-feature-name

# Create pull request on GitHub
```

### Commit Message Convention
Follow conventional commits:
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes
- `refactor:` Code refactoring
- `test:` Adding or updating tests
- `chore:` Maintenance tasks

### Code Style Guidelines
```typescript
// TypeScript/React best practices

// 1. Use TypeScript interfaces for props
interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
  onClick?: () => void;
}

// 2. Use functional components with hooks
export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  onClick 
}) => {
  return (
    <button 
      className={cn('btn', `btn-${variant}`)}
      onClick={onClick}
    >
      {children}
    </button>
  );
};

// 3. Custom hooks for reusable logic
export const useLocalStorage = <T>(key: string, initialValue: T) => {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  };

  return [storedValue, setValue] as const;
};
```

## Testing Setup

### Running Tests
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e

# Run E2E tests in headed mode
npm run test:e2e:headed
```

### Writing Tests
```typescript
// Component test example
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('should render correctly', () => {
    render(<Button>Test Button</Button>);
    expect(screen.getByRole('button', { name: 'Test Button' })).toBeInTheDocument();
  });
});

// Hook test example
import { renderHook, act } from '@testing-library/react';
import { useLocalStorage } from './useLocalStorage';

describe('useLocalStorage', () => {
  it('should store and retrieve values', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));
    
    expect(result.current[0]).toBe('initial');
    
    act(() => {
      result.current[1]('updated');
    });
    
    expect(result.current[0]).toBe('updated');
  });
});
```

## Database Development

### Schema Changes
```bash
# Create new migration
supabase migration new your_migration_name

# Apply migrations
supabase db reset

# Generate TypeScript types
supabase gen types typescript --local > src/integrations/supabase/types.ts
```

### Database Development Best Practices
```sql
-- Always use transactions for multiple operations
BEGIN;
  -- Your operations here
  INSERT INTO table1 (column1) VALUES ('value1');
  UPDATE table2 SET column2 = 'value2' WHERE id = 1;
COMMIT;

-- Always include RLS policies for new tables
ALTER TABLE your_table ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access their own data" 
ON your_table FOR ALL 
USING (auth.uid() = user_id);

-- Include proper indexes for performance
CREATE INDEX idx_your_table_user_id ON your_table(user_id);
CREATE INDEX idx_your_table_created_at ON your_table(created_at);
```

## Debugging

### Debug Configuration
```typescript
// lib/debug.ts
export const debug = {
  enabled: process.env.NODE_ENV === 'development' || process.env.VITE_DEBUG_MODE === 'true',
  
  log: (message: string, data?: any) => {
    if (debug.enabled) {
      console.log(`[DEBUG] ${message}`, data);
    }
  },
  
  error: (message: string, error?: any) => {
    if (debug.enabled) {
      console.error(`[DEBUG ERROR] ${message}`, error);
    }
  }
};
```

### VS Code Debug Configuration
```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug React App",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/.bin/vite",
      "args": ["dev"],
      "env": {
        "NODE_ENV": "development"
      },
      "console": "integratedTerminal",
      "skipFiles": ["<node_internals>/**"]
    }
  ]
}
```

### Browser DevTools
- **React DevTools**: Essential for React component debugging
- **Network Tab**: Monitor API calls and performance
- **Application Tab**: Check localStorage, sessionStorage, and cookies
- **Console**: Use debug.log for development logging

## Performance Development

### Performance Monitoring in Development
```typescript
// Performance utilities
export const performanceUtils = {
  measureComponent: (name: string) => {
    return function<T extends React.ComponentType<any>>(WrappedComponent: T): T {
      const MeasuredComponent = (props: any) => {
        const renderStart = performance.now();
        
        useEffect(() => {
          const renderEnd = performance.now();
          console.log(`[PERF] ${name} render time: ${renderEnd - renderStart}ms`);
        });
        
        return <WrappedComponent {...props} />;
      };
      
      return MeasuredComponent as T;
    };
  }
};

// Usage
export const ExpensiveComponent = performanceUtils.measureComponent('ExpensiveComponent')(
  ({ data }: { data: any[] }) => {
    // Component implementation
  }
);
```

### Bundle Analysis
```bash
# Analyze bundle size
npm run build
npm run preview

# Use bundle analyzer (if configured)
npm run analyze
```

## Troubleshooting Common Issues

### TypeScript Issues
```bash
# Clear TypeScript cache
npm run type-check
# or
npx tsc --noEmit

# Regenerate Supabase types
supabase gen types typescript --local > src/integrations/supabase/types.ts
```

### Dependency Issues
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Check for outdated packages
npm outdated

# Update packages
npm update
```

### Supabase Connection Issues
1. Check environment variables in `.env.local`
2. Verify Supabase project settings
3. Check network connectivity
4. Validate API keys and permissions

### Build Issues
```bash
# Clear Vite cache
rm -rf node_modules/.vite

# Clear build directory
rm -rf dist

# Rebuild
npm run build
```

## Code Quality Tools

### ESLint Configuration
```json
// .eslintrc.json
{
  "extends": [
    "eslint:recommended",
    "@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended"
  ],
  "rules": {
    "react/react-in-jsx-scope": "off",
    "@typescript-eslint/no-unused-vars": "error",
    "prefer-const": "error"
  }
}
```

### Prettier Configuration
```json
// .prettierrc
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2
}
```

### Pre-commit Hooks
```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged"
    }
  },
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write",
      "git add"
    ]
  }
}
```

## Team Development

### Code Review Checklist
- [ ] Code follows style guidelines
- [ ] Tests are included for new features
- [ ] Documentation is updated
- [ ] No console.log statements in production code
- [ ] TypeScript types are properly defined
- [ ] Error handling is implemented
- [ ] Performance considerations addressed

### Documentation Standards
- Document complex business logic
- Include JSDoc for utility functions
- Update README for new features
- Maintain API documentation
- Keep setup instructions current

### Knowledge Sharing
- Regular team code review sessions
- Architecture decision records (ADRs)
- Team learning sessions for new technologies
- Documentation of common patterns and solutions