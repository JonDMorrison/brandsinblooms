/**
 * Newsletter Debug Utilities
 * STEP 8: Conditional logging for newsletter builder debugging
 * 
 * Usage:
 *   newsletterDebug.log('save', 'Campaign saved', { id: '123' })
 *   newsletterDebug.log('image', 'Image generation started')
 *   newsletterDebug.log('prefill', 'Prefill applied')
 * 
 * Enable by setting localStorage.setItem('NEWSLETTER_DEBUG', 'true')
 * Or specific categories: localStorage.setItem('NEWSLETTER_DEBUG', 'save,load,image')
 */

type DebugCategory = 
  | 'save'       // Save/autosave events
  | 'load'       // Load/restore events
  | 'image'      // Image generation
  | 'prefill'    // Prefill application
  | 'hydration'  // Block hydration
  | 'timezone'   // Timezone conversions
  | 'mapping'    // Block field mapping
  | 'persistence' // LocalStorage/draft persistence
  | 'all';       // Enable all categories

interface DebugConfig {
  enabled: boolean;
  categories: Set<DebugCategory>;
}

class NewsletterDebug {
  private config: DebugConfig = {
    enabled: false,
    categories: new Set(),
  };

  constructor() {
    this.loadConfig();
    
    // Listen for storage changes to update config dynamically
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', () => this.loadConfig());
    }
  }

  private loadConfig(): void {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return;
    }

    try {
      const debugValue = localStorage.getItem('NEWSLETTER_DEBUG');
      
      if (!debugValue) {
        this.config.enabled = false;
        this.config.categories.clear();
        return;
      }

      if (debugValue === 'true' || debugValue === 'all') {
        this.config.enabled = true;
        this.config.categories.add('all');
        return;
      }

      // Parse comma-separated categories
      const categories = debugValue.split(',').map(c => c.trim().toLowerCase()) as DebugCategory[];
      this.config.enabled = categories.length > 0;
      this.config.categories = new Set(categories);
      
    } catch (error) {
      console.warn('Failed to load newsletter debug config:', error);
    }
  }

  private shouldLog(category: DebugCategory): boolean {
    if (!this.config.enabled) return false;
    if (this.config.categories.has('all')) return true;
    return this.config.categories.has(category);
  }

  private formatMessage(category: DebugCategory, message: string): string {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
    const categoryIcons: Record<DebugCategory, string> = {
      save: '💾',
      load: '📂',
      image: '🖼️',
      prefill: '📋',
      hydration: '💧',
      timezone: '🌍',
      mapping: '🗺️',
      persistence: '📦',
      all: '📊',
    };
    
    return `[${timestamp}] ${categoryIcons[category] || '📊'} [${category.toUpperCase()}] ${message}`;
  }

  /**
   * Log a debug message for a specific category
   */
  log(category: DebugCategory, message: string, data?: any): void {
    if (!this.shouldLog(category)) return;
    
    const formattedMessage = this.formatMessage(category, message);
    
    if (data !== undefined) {
      console.log(formattedMessage, data);
    } else {
      console.log(formattedMessage);
    }
  }

  /**
   * Log a warning for a specific category
   */
  warn(category: DebugCategory, message: string, data?: any): void {
    if (!this.shouldLog(category)) return;
    
    const formattedMessage = this.formatMessage(category, message);
    
    if (data !== undefined) {
      console.warn(formattedMessage, data);
    } else {
      console.warn(formattedMessage);
    }
  }

  /**
   * Log an error (always logs, not category-dependent)
   */
  error(category: DebugCategory, message: string, error?: any): void {
    const formattedMessage = this.formatMessage(category, message);
    console.error(formattedMessage, error);
  }

  /**
   * Create a timer for performance measurement
   */
  startTimer(category: DebugCategory, label: string): () => void {
    if (!this.shouldLog(category)) {
      return () => {}; // No-op if not logging
    }
    
    const start = performance.now();
    return () => {
      const duration = (performance.now() - start).toFixed(2);
      this.log(category, `${label} completed in ${duration}ms`);
    };
  }

  /**
   * Log block state for debugging
   */
  logBlockState(block: { id: string; type: string; status?: string; hasGeneratedContent?: boolean; userEdited?: boolean }, context: string): void {
    this.log('hydration', `[${context}] Block ${block.id} (${block.type})`, {
      status: block.status || 'undefined',
      hasGeneratedContent: block.hasGeneratedContent,
      userEdited: block.userEdited,
    });
  }

  /**
   * Enable debugging programmatically
   */
  enable(categories: DebugCategory[] = ['all']): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('NEWSLETTER_DEBUG', categories.join(','));
      this.loadConfig();
      console.log('Newsletter debugging enabled for categories:', categories);
    }
  }

  /**
   * Disable debugging
   */
  disable(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('NEWSLETTER_DEBUG');
      this.loadConfig();
      console.log('Newsletter debugging disabled');
    }
  }

  /**
   * Check if debugging is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }
}

// Export singleton instance
export const newsletterDebug = new NewsletterDebug();

// Expose to window for easy console access
if (typeof window !== 'undefined') {
  (window as any).newsletterDebug = newsletterDebug;
}
