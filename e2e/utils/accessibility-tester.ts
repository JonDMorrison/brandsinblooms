import { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

export interface A11yViolation {
  id: string;
  impact: 'minor' | 'moderate' | 'serious' | 'critical';
  description: string;
  help: string;
  helpUrl: string;
  nodes: Array<{
    target: string[];
    html: string;
    failureSummary?: string;
  }>;
}

export interface A11yResult {
  violations: A11yViolation[];
  passes: number;
  inapplicable: number;
  incomplete: number;
  url: string;
  timestamp: string;
}

export class AccessibilityTester {
  constructor(private page: Page) {}

  async scanPage(options?: {
    includeTags?: string[];
    excludeTags?: string[];
    disableRules?: string[];
  }): Promise<A11yResult> {
    console.log(`🔍 Running accessibility scan on: ${this.page.url()}`);
    
    try {
      let axeBuilder = new AxeBuilder({ page: this.page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa']);

      // Apply options
      if (options?.includeTags) {
        axeBuilder = axeBuilder.withTags(options.includeTags);
      }
      
      if (options?.excludeTags) {
        axeBuilder = axeBuilder.exclude(options.excludeTags);
      }
      
      if (options?.disableRules) {
        axeBuilder = axeBuilder.disableRules(options.disableRules);
      }

      const results = await axeBuilder.analyze();
      
      const a11yResult: A11yResult = {
        violations: results.violations.map(violation => ({
          id: violation.id,
          impact: violation.impact || 'moderate',
          description: violation.description,
          help: violation.help,
          helpUrl: violation.helpUrl,
          nodes: violation.nodes.map(node => ({
            target: node.target,
            html: node.html,
            failureSummary: node.failureSummary
          }))
        })),
        passes: results.passes.length,
        inapplicable: results.inapplicable.length,
        incomplete: results.incomplete.length,
        url: this.page.url(),
        timestamp: new Date().toISOString()
      };

      // Log summary
      const critical = a11yResult.violations.filter(v => v.impact === 'critical').length;
      const serious = a11yResult.violations.filter(v => v.impact === 'serious').length;
      const moderate = a11yResult.violations.filter(v => v.impact === 'moderate').length;
      const minor = a11yResult.violations.filter(v => v.impact === 'minor').length;

      console.log(`✅ A11y scan complete:
        🔴 Critical: ${critical}
        🟠 Serious: ${serious}
        🟡 Moderate: ${moderate}
        🔵 Minor: ${minor}
        ✅ Passes: ${a11yResult.passes}`);

      return a11yResult;
      
    } catch (error) {
      console.error('❌ Accessibility scan failed:', error);
      throw error;
    }
  }

  async checkKeyboardNavigation(): Promise<boolean> {
    console.log('⌨️ Testing keyboard navigation...');
    
    try {
      // Test tab navigation
      const focusableElements = await this.page.locator('[tabindex="0"], button, a, input, select, textarea').all();
      
      let tabCount = 0;
      for (const element of focusableElements.slice(0, 10)) { // Test first 10 elements
        await this.page.keyboard.press('Tab');
        tabCount++;
        
        const focused = await this.page.locator(':focus').first();
        const isVisible = await focused.isVisible().catch(() => false);
        
        if (!isVisible) {
          console.warn(`⚠️ Tab ${tabCount}: Focus moved to invisible element`);
          return false;
        }
      }

      // Test Escape key on dialogs/modals
      const modals = await this.page.locator('[role="dialog"], .modal, [aria-modal="true"]').all();
      for (const modal of modals) {
        if (await modal.isVisible()) {
          await this.page.keyboard.press('Escape');
          const isStillVisible = await modal.isVisible().catch(() => false);
          if (isStillVisible) {
            console.warn('⚠️ Modal did not close with Escape key');
            return false;
          }
        }
      }

      console.log('✅ Keyboard navigation passed');
      return true;
      
    } catch (error) {
      console.error('❌ Keyboard navigation test failed:', error);
      return false;
    }
  }

  async checkFocusManagement(): Promise<boolean> {
    console.log('🎯 Testing focus management...');
    
    try {
      // Test that interactive elements have visible focus indicators
      const interactiveElements = await this.page.locator('button, a, input, select, textarea, [tabindex="0"]').all();
      
      for (const element of interactiveElements.slice(0, 5)) {
        await element.focus();
        
        // Check if element has focus styles
        const computedStyle = await element.evaluate((el) => {
          const styles = window.getComputedStyle(el, ':focus');
          return {
            outline: styles.outline,
            boxShadow: styles.boxShadow,
            border: styles.border
          };
        });
        
        const hasFocusIndicator = 
          computedStyle.outline !== 'none' ||
          computedStyle.boxShadow !== 'none' ||
          computedStyle.border !== 'none';
          
        if (!hasFocusIndicator) {
          console.warn('⚠️ Element lacks visible focus indicator:', await element.innerHTML());
        }
      }

      console.log('✅ Focus management check completed');
      return true;
      
    } catch (error) {
      console.error('❌ Focus management test failed:', error);
      return false;
    }
  }

  async checkScreenReaderCompatibility(): Promise<boolean> {
    console.log('👁️ Testing screen reader compatibility...');
    
    try {
      // Check for proper heading structure
      const headings = await this.page.locator('h1, h2, h3, h4, h5, h6').all();
      const headingLevels = [];
      
      for (const heading of headings) {
        const tagName = await heading.evaluate(el => el.tagName.toLowerCase());
        const level = parseInt(tagName.substring(1));
        headingLevels.push(level);
      }
      
      // Check for logical heading structure (no skipped levels)
      for (let i = 1; i < headingLevels.length; i++) {
        if (headingLevels[i] - headingLevels[i-1] > 1) {
          console.warn(`⚠️ Heading structure skips from h${headingLevels[i-1]} to h${headingLevels[i]}`);
        }
      }

      // Check for alt text on images
      const images = await this.page.locator('img').all();
      for (const img of images.slice(0, 5)) {
        const alt = await img.getAttribute('alt');
        const ariaLabel = await img.getAttribute('aria-label');
        const ariaLabelledby = await img.getAttribute('aria-labelledby');
        
        if (!alt && !ariaLabel && !ariaLabelledby) {
          console.warn('⚠️ Image without alt text or aria-label');
        }
      }

      // Check form labels
      const inputs = await this.page.locator('input, select, textarea').all();
      for (const input of inputs.slice(0, 5)) {
        const id = await input.getAttribute('id');
        const ariaLabel = await input.getAttribute('aria-label');
        const ariaLabelledby = await input.getAttribute('aria-labelledby');
        
        let hasLabel = false;
        if (id) {
          const label = await this.page.locator(`label[for="${id}"]`).count();
          hasLabel = label > 0;
        }
        
        if (!hasLabel && !ariaLabel && !ariaLabelledby) {
          console.warn('⚠️ Form input without associated label');
        }
      }

      console.log('✅ Screen reader compatibility check completed');
      return true;
      
    } catch (error) {
      console.error('❌ Screen reader compatibility test failed:', error);
      return false;
    }
  }

  async failOnCriticalViolations(result: A11yResult): Promise<void> {
    const critical = result.violations.filter(v => v.impact === 'critical');
    const serious = result.violations.filter(v => v.impact === 'serious');
    
    if (critical.length > 0 || serious.length > 0) {
      const violations = [...critical, ...serious];
      const violationDetails = violations.map(v => 
        `${v.impact.toUpperCase()}: ${v.id} - ${v.description}`
      ).join('\n');
      
      throw new Error(`Accessibility violations found:\n${violationDetails}\n\nURL: ${result.url}`);
    }
  }

  generateA11yReport(results: A11yResult[]): string {
    const timestamp = new Date().toISOString();
    let report = `# Accessibility Test Report

**Generated:** ${timestamp}
**Pages Tested:** ${results.length}

## Summary

`;

    const totalViolations = results.reduce((sum, r) => sum + r.violations.length, 0);
    const criticalCount = results.reduce((sum, r) => 
      sum + r.violations.filter(v => v.impact === 'critical').length, 0
    );
    const seriousCount = results.reduce((sum, r) => 
      sum + r.violations.filter(v => v.impact === 'serious').length, 0
    );

    report += `- **Total Violations:** ${totalViolations}
- **Critical:** ${criticalCount}
- **Serious:** ${seriousCount}
- **Status:** ${criticalCount === 0 && seriousCount === 0 ? '✅ PASSED' : '❌ FAILED'}

## Page Results

`;

    results.forEach(result => {
      const critical = result.violations.filter(v => v.impact === 'critical').length;
      const serious = result.violations.filter(v => v.impact === 'serious').length;
      
      report += `### ${result.url}
- **Violations:** ${result.violations.length}
- **Critical:** ${critical}
- **Serious:** ${serious}
- **Passes:** ${result.passes}

`;

      if (result.violations.length > 0) {
        result.violations.forEach(violation => {
          report += `#### ${violation.impact.toUpperCase()}: ${violation.id}
**Description:** ${violation.description}
**Help:** ${violation.help}
**Learn More:** ${violation.helpUrl}

`;
        });
      }
    });

    return report;
  }
}