/**
 * Production readiness checklist and validation
 */

export interface ChecklistItem {
  id: string;
  name: string;
  completed: boolean;
  critical: boolean;
  description: string;
}

export const PRODUCTION_CHECKLIST: ChecklistItem[] = [
  // Critical Security Issues
  {
    id: 'elfsight-removal',
    name: 'Remove Elfsight Widget',
    completed: true,
    critical: true,
    description: 'Third-party chat widget removed from production HTML'
  },
  {
    id: 'console-cleanup',
    name: 'Console Statement Cleanup',
    completed: true,
    critical: true,
    description: 'Debug console statements removed from production code'
  },
  {
    id: 'html-sanitization',
    name: 'HTML Sanitization',
    completed: true,
    critical: true,
    description: 'dangerouslySetInnerHTML usage secured with sanitization'
  },
  {
    id: 'dev-bypasses',
    name: 'Development Bypasses Removed',
    completed: true,
    critical: true,
    description: 'Developer-only access controls cleaned up'
  },
  
  // High Priority SEO
  {
    id: 'meta-tags',
    name: 'SEO Meta Tags',
    completed: true,
    critical: false,
    description: 'Comprehensive meta tags, Open Graph, and Twitter cards added'
  },
  {
    id: 'font-optimization',
    name: 'Font Loading Optimization',
    completed: true,
    critical: false,
    description: 'Font display swap and preload optimization implemented'
  },
  
  // Performance
  {
    id: 'lazy-loading',
    name: 'Image Lazy Loading',
    completed: false,
    critical: false,
    description: 'Consistent lazy loading implementation across all images'
  },
  {
    id: 'error-boundaries',
    name: 'Error Boundary Standardization',
    completed: true,
    critical: false,
    description: 'Consistent error handling patterns implemented'
  },
  
  // Test/Debug Cleanup
  {
    id: 'test-routes',
    name: 'Test Routes Removal',
    completed: true,
    critical: true,
    description: 'Test pages redirect to main application'
  }
];

export const getProductionReadinessScore = (): { score: number; critical: number; total: number } => {
  const criticalItems = PRODUCTION_CHECKLIST.filter(item => item.critical);
  const completedCritical = criticalItems.filter(item => item.completed);
  const totalCompleted = PRODUCTION_CHECKLIST.filter(item => item.completed);
  
  return {
    score: Math.round((totalCompleted.length / PRODUCTION_CHECKLIST.length) * 100),
    critical: completedCritical.length,
    total: criticalItems.length
  };
};

export const getRemainingIssues = (): ChecklistItem[] => {
  return PRODUCTION_CHECKLIST.filter(item => !item.completed);
};

export const getCriticalIssues = (): ChecklistItem[] => {
  return PRODUCTION_CHECKLIST.filter(item => !item.completed && item.critical);
};