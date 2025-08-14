import { Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

export interface TestFailure {
  testName: string;
  suiteName: string;
  status: 'pass' | 'fail';
  reproSteps: string[];
  expected: string;
  actual: string;
  environment: {
    browser: string;
    viewport: string;
    userAgent: string;
  };
  artifacts: {
    screenshot?: string;
    video?: string;
    logs?: string;
    har?: string;
  };
  suggestedOwner: 'Frontend' | 'Backend' | 'Edge Function' | 'RLS/DB' | 'Infrastructure';
  severity: 'Blocker' | 'High' | 'Medium' | 'Low';
  timestamp: string;
}

export class TestReporter {
  private failures: TestFailure[] = [];
  private supabase;

  constructor(private page: Page) {
    this.supabase = createClient(
      process.env.VITE_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
  }

  async captureFailure(failure: Omit<TestFailure, 'environment' | 'timestamp' | 'artifacts'>) {
    const environment = {
      browser: this.page.context().browser()?.browserType().name() || 'unknown',
      viewport: `${this.page.viewportSize()?.width}x${this.page.viewportSize()?.height}`,
      userAgent: await this.page.evaluate(() => navigator.userAgent)
    };

    // Capture artifacts
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const testId = `${failure.suiteName}_${failure.testName}`.replace(/\s+/g, '_');
    
    const artifacts: TestFailure['artifacts'] = {};

    try {
      // Screenshot
      const screenshotPath = `screenshots/${testId}_${timestamp}.png`;
      await this.page.screenshot({ 
        path: `e2e/artifacts/${screenshotPath}`,
        fullPage: true 
      });
      artifacts.screenshot = screenshotPath;

      // Console logs
      const logs = await this.page.evaluate(() => {
        const logs = (window as any).testLogs || [];
        return logs.slice(-50); // Last 50 log entries
      });
      artifacts.logs = JSON.stringify(logs, null, 2);

      // Network HAR if possible
      const context = this.page.context();
      if (context) {
        const harPath = `network/${testId}_${timestamp}.har`;
        await context.tracing.stop({ path: `e2e/artifacts/${harPath}` });
        artifacts.har = harPath;
      }

    } catch (error) {
      console.warn('Failed to capture some artifacts:', error);
    }

    const fullFailure: TestFailure = {
      ...failure,
      environment,
      artifacts,
      timestamp: new Date().toISOString()
    };

    this.failures.push(fullFailure);
  }

  async generateReport() {
    const report = this.generateMarkdownReport();
    const jsonReport = this.generateJSONReport();

    // Save to local files
    await this.saveReport('markdown', report);
    await this.saveReport('json', jsonReport);

    // Upload to Supabase Storage
    await this.uploadToStorage(report, jsonReport);
  }

  private generateMarkdownReport(): string {
    const timestamp = new Date().toISOString();
    const totalTests = this.failures.length;
    const failedTests = this.failures.filter(f => f.status === 'fail').length;
    const passedTests = totalTests - failedTests;

    let markdown = `# BloomSuite Pre-Beta E2E Test Report

**Generated:** ${timestamp}
**Environment:** ${process.env.ENVIRONMENT || 'staging'}
**Total Tests:** ${totalTests}
**Passed:** ${passedTests}
**Failed:** ${failedTests}

---

## Executive Summary

${failedTests === 0 
  ? '✅ All tests passed! BloomSuite is ready for beta release.'
  : `❌ ${failedTests} test(s) failed. Review the issues below before beta release.`
}

## Test Results by Suite

`;

    // Group failures by suite
    const suites = new Map<string, TestFailure[]>();
    this.failures.forEach(failure => {
      if (!suites.has(failure.suiteName)) {
        suites.set(failure.suiteName, []);
      }
      suites.get(failure.suiteName)!.push(failure);
    });

    suites.forEach((failures, suiteName) => {
      const suitePassed = failures.filter(f => f.status === 'pass').length;
      const suiteFailed = failures.filter(f => f.status === 'fail').length;
      
      markdown += `### ${suiteName}
**Status:** ${suiteFailed === 0 ? '✅ PASSED' : '❌ FAILED'}
**Tests:** ${suitePassed} passed, ${suiteFailed} failed

`;

      failures.filter(f => f.status === 'fail').forEach(failure => {
        markdown += `#### ❌ ${failure.testName}

**Severity:** ${failure.severity}
**Suggested Owner:** ${failure.suggestedOwner}
**Environment:** ${failure.environment.browser} ${failure.environment.viewport}

**Reproduction Steps:**
${failure.reproSteps.map((step, i) => `${i + 1}. ${step}`).join('\n')}

**Expected:** ${failure.expected}
**Actual:** ${failure.actual}

**Artifacts:**
${failure.artifacts.screenshot ? `- Screenshot: \`${failure.artifacts.screenshot}\`` : ''}
${failure.artifacts.video ? `- Video: \`${failure.artifacts.video}\`` : ''}
${failure.artifacts.logs ? `- Console Logs: Available` : ''}
${failure.artifacts.har ? `- Network HAR: \`${failure.artifacts.har}\`` : ''}

---

`;
      });
    });

    markdown += `## Recommendations

${failedTests === 0 
  ? '- Proceed with beta release\n- Continue monitoring in production'
  : this.generateRecommendations()
}

## Next Steps

1. Review and triage failed tests
2. Assign to appropriate team members
3. Implement fixes
4. Re-run affected test suites
5. Update this report

---

*Report generated automatically by BloomSuite E2E Test Suite*
`;

    return markdown;
  }

  private generateJSONReport(): string {
    const summary = {
      timestamp: new Date().toISOString(),
      environment: process.env.ENVIRONMENT || 'staging',
      totals: {
        tests: this.failures.length,
        passed: this.failures.filter(f => f.status === 'pass').length,
        failed: this.failures.filter(f => f.status === 'fail').length
      },
      suites: this.groupBySuite(),
      failures: this.failures.filter(f => f.status === 'fail'),
      recommendations: this.generateRecommendations()
    };

    return JSON.stringify(summary, null, 2);
  }

  private groupBySuite() {
    const suites = new Map<string, any>();
    this.failures.forEach(failure => {
      if (!suites.has(failure.suiteName)) {
        suites.set(failure.suiteName, {
          name: failure.suiteName,
          passed: 0,
          failed: 0,
          tests: []
        });
      }
      const suite = suites.get(failure.suiteName)!;
      if (failure.status === 'pass') {
        suite.passed++;
      } else {
        suite.failed++;
      }
      suite.tests.push(failure);
    });

    return Array.from(suites.values());
  }

  private generateRecommendations(): string {
    const blockers = this.failures.filter(f => f.severity === 'Blocker' && f.status === 'fail');
    const high = this.failures.filter(f => f.severity === 'High' && f.status === 'fail');
    
    let recommendations = '';
    
    if (blockers.length > 0) {
      recommendations += `- **URGENT:** Fix ${blockers.length} blocker issue(s) before beta release\n`;
    }
    
    if (high.length > 0) {
      recommendations += `- Address ${high.length} high-priority issue(s) in next sprint\n`;
    }
    
    recommendations += '- Review RLS policies for any security concerns\n';
    recommendations += '- Validate external service integrations\n';
    recommendations += '- Consider adding more comprehensive error handling\n';
    
    return recommendations;
  }

  private async saveReport(type: 'markdown' | 'json', content: string) {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const ext = type === 'markdown' ? 'md' : 'json';
    const filename = `bloomsuite_prebeta_report.${ext}`;
    const filepath = path.join('e2e/reports', filename);
    
    try {
      await fs.mkdir('e2e/reports', { recursive: true });
      await fs.writeFile(filepath, content, 'utf-8');
      console.log(`📄 Report saved: ${filepath}`);
    } catch (error) {
      console.error(`Failed to save ${type} report:`, error);
    }
  }

  private async uploadToStorage(markdownReport: string, jsonReport: string) {
    try {
      const timestamp = new Date().toISOString().split('T')[0];
      
      // Upload markdown report
      const { error: mdError } = await this.supabase.storage
        .from('qa-reports')
        .upload(`${timestamp}/bloomsuite_prebeta_report.md`, markdownReport, {
          contentType: 'text/markdown',
          upsert: true
        });

      if (mdError) {
        console.error('Failed to upload markdown report:', mdError);
      }

      // Upload JSON report
      const { error: jsonError } = await this.supabase.storage
        .from('qa-reports')
        .upload(`${timestamp}/bloomsuite_prebeta_report.json`, jsonReport, {
          contentType: 'application/json',
          upsert: true
        });

      if (jsonError) {
        console.error('Failed to upload JSON report:', jsonError);
      }

      console.log(`☁️ Reports uploaded to Supabase Storage: qa-reports/${timestamp}/`);
      
    } catch (error) {
      console.error('Failed to upload reports to storage:', error);
    }
  }
}