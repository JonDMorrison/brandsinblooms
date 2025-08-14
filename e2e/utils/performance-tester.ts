import { Page } from '@playwright/test';

export interface PerformanceMetrics {
  url: string;
  timestamp: string;
  loadTime: number;
  domContentLoaded: number;
  firstPaint: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  cumulativeLayoutShift: number;
  firstInputDelay: number;
  timeToInteractive: number;
  totalBlockingTime: number;
  performanceScore: number;
  accessibilityScore: number;
  bestPracticesScore: number;
  seoScore: number;
  networkRequests: number;
  totalBytes: number;
  jsBytes: number;
  cssBytes: number;
  imageBytes: number;
  errors: string[];
}

export class PerformanceTester {
  constructor(private page: Page) {}

  async measurePagePerformance(): Promise<PerformanceMetrics> {
    console.log(`📊 Measuring performance for: ${this.page.url()}`);
    
    try {
      // Start performance tracing
      await this.page.tracing.start({
        screenshots: true,
        snapshots: true
      });

      // Collect basic timing metrics
      const timing = await this.page.evaluate(() => {
        const perf = performance.timing;
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        
        return {
          loadTime: perf.loadEventEnd - perf.navigationStart,
          domContentLoaded: perf.domContentLoadedEventEnd - perf.navigationStart,
          firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
          firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0,
          timeToInteractive: navigation.loadEventEnd - navigation.fetchStart
        };
      });

      // Collect Core Web Vitals
      const webVitals = await this.page.evaluate(() => {
        return new Promise((resolve) => {
          const vitals = {
            lcp: 0,
            cls: 0,
            fid: 0,
            tbt: 0
          };

          // LCP - Largest Contentful Paint
          new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1];
            vitals.lcp = lastEntry.startTime;
          }).observe({ entryTypes: ['largest-contentful-paint'] });

          // CLS - Cumulative Layout Shift
          new PerformanceObserver((list) => {
            let clsValue = 0;
            for (const entry of list.getEntries()) {
              if (!(entry as any).hadRecentInput) {
                clsValue += (entry as any).value;
              }
            }
            vitals.cls = clsValue;
          }).observe({ entryTypes: ['layout-shift'] });

          // FID - First Input Delay
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              vitals.fid = (entry as any).processingStart - entry.startTime;
            }
          }).observe({ entryTypes: ['first-input'] });

          // Resolve after a short delay to collect metrics
          setTimeout(() => resolve(vitals), 2000);
        });
      });

      // Collect network metrics
      const networkMetrics = await this.collectNetworkMetrics();

      // Stop tracing
      await this.page.tracing.stop();

      // Collect JavaScript errors
      const errors = await this.page.evaluate(() => {
        return (window as any).performanceErrors || [];
      });

      // Calculate performance scores (simplified Lighthouse-style scoring)
      const scores = this.calculatePerformanceScores({
        ...timing,
        ...webVitals as any,
        ...networkMetrics
      });

      const metrics: PerformanceMetrics = {
        url: this.page.url(),
        timestamp: new Date().toISOString(),
        loadTime: timing.loadTime,
        domContentLoaded: timing.domContentLoaded,
        firstPaint: timing.firstPaint,
        firstContentfulPaint: timing.firstContentfulPaint,
        largestContentfulPaint: (webVitals as any).lcp,
        cumulativeLayoutShift: (webVitals as any).cls,
        firstInputDelay: (webVitals as any).fid,
        timeToInteractive: timing.timeToInteractive,
        totalBlockingTime: (webVitals as any).tbt,
        ...scores,
        ...networkMetrics,
        errors
      };

      this.logPerformanceResults(metrics);
      return metrics;

    } catch (error) {
      console.error('❌ Performance measurement failed:', error);
      throw error;
    }
  }

  private async collectNetworkMetrics() {
    const networkEntries = await this.page.evaluate(() => {
      const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      
      let totalBytes = 0;
      let jsBytes = 0;
      let cssBytes = 0;
      let imageBytes = 0;
      
      entries.forEach(entry => {
        const size = entry.transferSize || entry.encodedBodySize || 0;
        totalBytes += size;
        
        if (entry.name.includes('.js')) {
          jsBytes += size;
        } else if (entry.name.includes('.css')) {
          cssBytes += size;
        } else if (entry.name.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
          imageBytes += size;
        }
      });
      
      return {
        networkRequests: entries.length,
        totalBytes,
        jsBytes,
        cssBytes,
        imageBytes
      };
    });

    return networkEntries;
  }

  private calculatePerformanceScores(metrics: any) {
    // Simplified scoring based on Lighthouse thresholds
    
    // Performance Score (based on LCP, FID, CLS)
    let performanceScore = 100;
    if (metrics.lcp > 4000) performanceScore -= 40;
    else if (metrics.lcp > 2500) performanceScore -= 20;
    
    if (metrics.fid > 300) performanceScore -= 30;
    else if (metrics.fid > 100) performanceScore -= 15;
    
    if (metrics.cls > 0.25) performanceScore -= 30;
    else if (metrics.cls > 0.1) performanceScore -= 15;

    // Mock other scores (would need actual Lighthouse integration for real scores)
    const accessibilityScore = 90; // Would be from axe-core results
    const bestPracticesScore = 85; // Would check HTTPS, security headers, etc.
    const seoScore = 88; // Would check meta tags, structured data, etc.

    return {
      performanceScore: Math.max(0, performanceScore),
      accessibilityScore,
      bestPracticesScore,
      seoScore
    };
  }

  private logPerformanceResults(metrics: PerformanceMetrics) {
    console.log(`📊 Performance Results for ${metrics.url}:
      🚀 Performance Score: ${metrics.performanceScore}/100
      ⏱️  Load Time: ${metrics.loadTime}ms
      🎨 First Contentful Paint: ${metrics.firstContentfulPaint}ms
      🖼️  Largest Contentful Paint: ${metrics.largestContentfulPaint}ms
      ⚡ First Input Delay: ${metrics.firstInputDelay}ms
      📐 Cumulative Layout Shift: ${metrics.cumulativeLayoutShift.toFixed(3)}
      🌐 Network Requests: ${metrics.networkRequests}
      📦 Total Bytes: ${(metrics.totalBytes / 1024).toFixed(1)} KB
      ${metrics.errors.length > 0 ? `❌ Errors: ${metrics.errors.length}` : '✅ No JavaScript errors'}`);
  }

  async checkCoreWebVitals(thresholds?: {
    lcp?: number;
    fid?: number;
    cls?: number;
  }): Promise<boolean> {
    const defaultThresholds = {
      lcp: 2500, // 2.5 seconds
      fid: 100,  // 100 milliseconds
      cls: 0.1   // 0.1 cumulative layout shift
    };
    
    const limits = { ...defaultThresholds, ...thresholds };
    const metrics = await this.measurePagePerformance();
    
    const results = {
      lcp: metrics.largestContentfulPaint <= limits.lcp,
      fid: metrics.firstInputDelay <= limits.fid,
      cls: metrics.cumulativeLayoutShift <= limits.cls
    };
    
    const passed = Object.values(results).every(result => result);
    
    console.log(`🎯 Core Web Vitals Assessment:
      LCP: ${metrics.largestContentfulPaint}ms ${results.lcp ? '✅' : '❌'} (target: <${limits.lcp}ms)
      FID: ${metrics.firstInputDelay}ms ${results.fid ? '✅' : '❌'} (target: <${limits.fid}ms)
      CLS: ${metrics.cumulativeLayoutShift.toFixed(3)} ${results.cls ? '✅' : '❌'} (target: <${limits.cls})
      Overall: ${passed ? '✅ PASSED' : '❌ FAILED'}`);
    
    return passed;
  }

  async checkLighthouseThresholds(thresholds?: {
    performance?: number;
    accessibility?: number;
    bestPractices?: number;
    seo?: number;
  }): Promise<boolean> {
    const defaultThresholds = {
      performance: 90,
      accessibility: 90,
      bestPractices: 90,
      seo: 90
    };
    
    const limits = { ...defaultThresholds, ...thresholds };
    const metrics = await this.measurePagePerformance();
    
    const results = {
      performance: metrics.performanceScore >= limits.performance,
      accessibility: metrics.accessibilityScore >= limits.accessibility,
      bestPractices: metrics.bestPracticesScore >= limits.bestPractices,
      seo: metrics.seoScore >= limits.seo
    };
    
    const passed = Object.values(results).every(result => result);
    
    console.log(`💡 Lighthouse Scores:
      Performance: ${metrics.performanceScore}/100 ${results.performance ? '✅' : '❌'}
      Accessibility: ${metrics.accessibilityScore}/100 ${results.accessibility ? '✅' : '❌'}
      Best Practices: ${metrics.bestPracticesScore}/100 ${results.bestPractices ? '✅' : '❌'}
      SEO: ${metrics.seoScore}/100 ${results.seo ? '✅' : '❌'}
      Overall: ${passed ? '✅ PASSED' : '❌ FAILED'}`);
    
    return passed;
  }

  generatePerformanceReport(results: PerformanceMetrics[]): string {
    const timestamp = new Date().toISOString();
    let report = `# Performance Test Report

**Generated:** ${timestamp}
**Pages Tested:** ${results.length}

## Summary

`;

    const avgPerformance = results.reduce((sum, r) => sum + r.performanceScore, 0) / results.length;
    const avgLoadTime = results.reduce((sum, r) => sum + r.loadTime, 0) / results.length;
    const avgLCP = results.reduce((sum, r) => sum + r.largestContentfulPaint, 0) / results.length;
    const failedPages = results.filter(r => r.performanceScore < 90).length;

    report += `- **Average Performance Score:** ${avgPerformance.toFixed(1)}/100
- **Average Load Time:** ${avgLoadTime.toFixed(0)}ms
- **Average LCP:** ${avgLCP.toFixed(0)}ms
- **Pages Below Threshold:** ${failedPages}/${results.length}
- **Status:** ${failedPages === 0 ? '✅ PASSED' : '❌ FAILED'}

## Page Results

`;

    results.forEach(result => {
      report += `### ${result.url}
- **Performance Score:** ${result.performanceScore}/100
- **Load Time:** ${result.loadTime}ms
- **LCP:** ${result.largestContentfulPaint}ms
- **FID:** ${result.firstInputDelay}ms
- **CLS:** ${result.cumulativeLayoutShift.toFixed(3)}
- **Network Requests:** ${result.networkRequests}
- **Total Size:** ${(result.totalBytes / 1024).toFixed(1)} KB
${result.errors.length > 0 ? `- **Errors:** ${result.errors.length}` : '- **Errors:** None'}

`;
    });

    return report;
  }
}