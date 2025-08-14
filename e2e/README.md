# BloomSuite Pre-Beta E2E Testing Infrastructure

## 🎯 Overview

This comprehensive E2E testing system validates BloomSuite's readiness for beta release by testing all critical workflows, validating RLS policies, checking accessibility compliance, and ensuring performance meets production standards.

## 🏗️ Architecture

### Test Structure
```
e2e/
├── fixtures/           # Test fixtures and setup
├── factories/          # Data seeding and factories  
├── suites/            # Test suites by feature area
├── utils/             # Testing utilities
├── scripts/           # Data management scripts
├── artifacts/         # Screenshots, videos, logs
└── reports/           # Generated test reports
```

### Safety Features
- **Environment Guards**: Tests only run on staging, never production
- **Data Isolation**: QA workspace with cleanup after tests
- **Mock Services**: Safe external API mocking for Twilio, Resend, POS systems

## 🧪 Test Suites

### Core Workflows (`core-workflows.spec.ts`)
- Dashboard loading and tile display
- Content Library search, filter, bundle interactions
- CRM customer management (CRUD operations)
- SMS demo functionality with compliance testing

### Create & Post Something (`create-post-workflows.spec.ts`) 
- Event path: Multi-channel generation → Publish Portal handoff
- Seasonal path: Single channel → Block Builder integration
- Custom path: Content editing, MediaSelector functionality
- Accessibility compliance validation

### Advanced CRM (`advanced-crm.spec.ts`)
- Automation builder with complex flows and A/B testing
- Campaign creation with revenue projections
- Customer segmentation with advanced rule builder
- Analytics dashboard and LTV tracking
- Persona management and assignment

### Admin & Permissions (`admin-permissions.spec.ts`)
- Admin panel access and user management
- Role-based access control (RLS validation)
- Cross-tenant data isolation testing
- Permission boundary enforcement

### Error Handling (`error-handling.spec.ts`)
- Network failure recovery with retry logic
- Edge function timeout handling
- Draft recovery after page reload
- Concurrent editing race conditions
- Input validation and SQL injection protection
- Memory leak prevention during long sessions

## 🔧 Testing Utilities

### Data Factory (`E2EDataFactory`)
Automatically seeds realistic test environment:
- **Workspace**: QA E2E Workspace
- **Users**: Admin, Editor, Viewer with proper roles
- **Customers**: 150 with mixed personas and engagement data
- **Segments**: 6 pre-configured customer segments
- **Events**: 4 upcoming events for content generation
- **Holidays**: 8 weeks seasonal + 4 annual holidays
- **Content Bundles**: 3 historical bundles with mixed approvals
- **Automations**: Welcome series, birthday offers, abandoned cart
- **Campaigns**: Email/SMS with realistic metrics
- **Analytics**: Attribution data for dashboard rendering

### External Service Mocks (`ExternalServiceMocks`)
- **Twilio SMS/MMS**: Test credentials, delivery webhooks, quiet hours compliance
- **Resend Email**: Sender verification, delivery tracking
- **POS Webhooks**: Shopify/Square integration simulation
- **Link Shortener**: Click tracking and attribution logging

### Accessibility Tester (`AccessibilityTester`)
- **axe-core Integration**: WCAG 2.1 AA compliance validation
- **Keyboard Navigation**: Tab order, escape key handling, focus indicators
- **Screen Reader Compatibility**: Heading structure, alt text, form labels
- **Critical Violation Blocking**: Fails tests on serious accessibility issues

### Performance Tester (`PerformanceTester`)
- **Core Web Vitals**: LCP, FID, CLS measurement and validation
- **Lighthouse Scoring**: Performance, Accessibility, Best Practices, SEO
- **Network Analysis**: Request count, payload sizes, resource optimization
- **Memory Monitoring**: Memory usage tracking during long sessions

### Test Reporter (`TestReporter`)
Generates comprehensive failure reports with:
- **Artifacts**: Screenshots, console logs, network HAR files
- **Reproduction Steps**: Detailed steps to reproduce issues
- **Environment Context**: Browser, viewport, user agent
- **Triage Information**: Suggested owner, severity classification
- **Report Formats**: Markdown and JSON for different audiences

## 🚀 Usage

### Environment Setup
```bash
# Copy E2E environment configuration
cp .env.e2e .env.local

# Install dependencies including accessibility testing
npm install @axe-core/playwright

# Install Playwright browsers
npx playwright install --with-deps
```

### Running Tests

#### Full Pre-Beta Suite
```bash
npm run test:e2e:prebeta
```

#### Individual Suites
```bash
npx playwright test e2e/suites/core-workflows.spec.ts
npx playwright test e2e/suites/create-post-workflows.spec.ts
npx playwright test e2e/suites/advanced-crm.spec.ts
npx playwright test e2e/suites/admin-permissions.spec.ts
npx playwright test e2e/suites/error-handling.spec.ts
```

#### Debug Mode
```bash
npm run test:e2e:debug
```

#### UI Mode (Interactive)
```bash
npm run test:e2e:ui
```

### Data Management

#### Seed Test Data
```bash
npm run test:seed
```

#### Cleanup Test Data
```bash
npm run test:cleanup
```

## 📊 Reporting

### Report Locations
- **HTML Report**: `npx playwright show-report`
- **JSON Report**: `e2e/reports/results.json`
- **Markdown Report**: `e2e/reports/bloomsuite_prebeta_report.md`
- **Artifacts**: `e2e/artifacts/screenshots/`, `e2e/artifacts/network/`

### Report Contents
- Executive summary with pass/fail status
- Test results grouped by suite
- Detailed failure analysis with reproduction steps
- Performance and accessibility metrics
- Recommendations for beta readiness

### CI/CD Integration
The GitHub Actions workflow (`.github/workflows/qa-prebeta.yml`) automatically:
- Runs the full test suite on staging
- Uploads artifacts to GitHub Actions
- Generates and stores reports in Supabase Storage
- Provides downloadable test evidence

## 🔒 Security & Compliance

### RLS Policy Validation
- Tests cross-tenant data isolation
- Validates role-based access controls
- Ensures users only see their workspace data
- Checks permission boundaries are enforced

### GDPR & Privacy Compliance
- Tests data deletion workflows
- Validates opt-out functionality for SMS
- Ensures customer data isolation
- Tests data export capabilities

### Input Validation
- SQL injection prevention testing
- XSS protection validation
- File upload security checks
- Form validation boundary testing

## 📈 Performance Standards

### Core Web Vitals Thresholds
- **Largest Contentful Paint (LCP)**: < 2.5 seconds
- **First Input Delay (FID)**: < 100 milliseconds  
- **Cumulative Layout Shift (CLS)**: < 0.1

### Lighthouse Score Thresholds
- **Performance**: ≥ 90/100
- **Accessibility**: ≥ 90/100
- **Best Practices**: ≥ 90/100
- **SEO**: ≥ 90/100

## 🚨 Failure Response

When tests fail, the system automatically:
1. **Captures Evidence**: Screenshots, logs, network traces
2. **Generates Reports**: Detailed markdown and JSON reports
3. **Classifies Issues**: Severity (Blocker/High/Medium/Low) and ownership
4. **Provides Context**: Environment details and reproduction steps
5. **Uploads Artifacts**: To Supabase Storage for team access

### Severity Classifications
- **Blocker**: Prevents beta release (security, data corruption)
- **High**: Major functionality broken, poor UX
- **Medium**: Minor functionality issues, performance degradation
- **Low**: UI inconsistencies, edge case bugs

## 🎯 Beta Readiness Criteria

✅ **All Blocker and High severity issues resolved**
✅ **Core Web Vitals meet performance thresholds**
✅ **No critical accessibility violations**
✅ **RLS policies properly isolate tenant data**
✅ **External integrations working with proper error handling**
✅ **SMS compliance features (STOP/HELP) functioning**
✅ **Draft recovery and autosave features stable**

---

*This E2E testing infrastructure ensures BloomSuite meets production quality standards before beta release.*