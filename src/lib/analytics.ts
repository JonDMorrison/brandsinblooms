import { User } from '@supabase/supabase-js';

interface UserIdentityData {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  country?: string;
  postalCode?: string;
}

interface AnalyticsWindow extends Window {
  rudderanalytics?: {
    identify: (userId: string, traits: Record<string, any>) => void;
    track: (event: string, properties?: Record<string, any>) => void;
    page: (name?: string, properties?: Record<string, any>) => void;
  };
  analytics?: {
    identify: (userId: string, traits: Record<string, any>) => void;
    track: (event: string, properties?: Record<string, any>) => void;
    page: (name?: string, properties?: Record<string, any>) => void;
  };
}

declare let window: AnalyticsWindow;

class AnalyticsService {
  private isInitialized = false;

  private getAnalyticsInstance() {
    return window.rudderanalytics || window.analytics;
  }

  private hasMinimumRequiredFields(userData: UserIdentityData): boolean {
    // Google Ads requirements: Email OR Phone is mandatory AND at least one of: firstName, lastName, postalCode, country
    const hasEmailOrPhone = !!(userData.email && userData.email.trim()) || !!(userData.phone && userData.phone.trim());
    const hasAdditionalField = !!(userData.firstName && userData.firstName.trim()) || 
                               !!(userData.lastName && userData.lastName.trim()) || 
                               !!(userData.postalCode && userData.postalCode.trim()) || 
                               !!(userData.country && userData.country.trim());
    
    console.log('🔍 Analytics: Field validation:', {
      hasEmailOrPhone,
      hasAdditionalField,
      email: userData.email ? 'present' : 'missing',
      phone: userData.phone ? 'present' : 'missing',
      firstName: userData.firstName ? 'present' : 'missing',
      lastName: userData.lastName ? 'present' : 'missing',
      postalCode: userData.postalCode ? 'present' : 'missing',
      country: userData.country ? 'present' : 'missing'
    });
    
    return hasEmailOrPhone && hasAdditionalField;
  }

  private extractUserData(user: User): UserIdentityData | null {
    const userData: UserIdentityData = {
      email: user.email || '',
      firstName: user.user_metadata?.first_name || user.user_metadata?.name?.split(' ')[0] || '',
      lastName: user.user_metadata?.last_name || user.user_metadata?.name?.split(' ').slice(1).join(' ') || '',
      phone: user.user_metadata?.phone || user.phone || '',
      country: user.user_metadata?.country || '',
      postalCode: user.user_metadata?.postal_code || user.user_metadata?.zip_code || ''
    };

    console.log('🔍 Analytics: Extracted user data:', {
      hasEmail: !!userData.email,
      hasPhone: !!userData.phone,
      hasFirstName: !!userData.firstName,
      hasLastName: !!userData.lastName,
      hasCountry: !!userData.country,
      hasPostalCode: !!userData.postalCode,
      userData: userData // Full data for debugging
    });

    const isValid = this.hasMinimumRequiredFields(userData);
    console.log(`🔍 Analytics: User data validation result: ${isValid}`);
    
    return isValid ? userData : null;
  }

  /**
   * Initialize analytics for an authenticated user
   * Only calls identify if we have the minimum required fields
   */
  identifyUser(user: User): void {
    console.log('🔍 Analytics: identifyUser called for user:', user.id);
    
    const analytics = this.getAnalyticsInstance();
    if (!analytics) {
      console.log('⚠️ Analytics: No analytics instance found');
      return;
    }

    const userData = this.extractUserData(user);
    
    if (userData) {
      try {
        console.log('✅ Analytics: Calling identify with validated data');
        analytics.identify(user.id, {
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          phone: userData.phone,
          country: userData.country,
          postalCode: userData.postalCode,
          createdAt: user.created_at,
          userId: user.id
        });
        
        console.log('✅ Analytics: User identified successfully');
        this.isInitialized = true;
      } catch (error) {
        console.error('❌ Analytics: Failed to identify user:', error);
      }
    } else {
      console.warn('⚠️ Analytics: Skipping user identification - insufficient data for Google Ads requirements');
      console.warn('⚠️ Analytics: Required: (email OR phone) AND (firstName OR lastName OR postalCode OR country)');
      // For users without sufficient data, we only track behavior, no identify
      this.trackBehaviorOnly();
    }
  }

  /**
   * Track behavior without identifying the user (for anonymous or insufficient data users)
   */
  trackBehaviorOnly(): void {
    const analytics = this.getAnalyticsInstance();
    if (!analytics) return;

    try {
      // Only track page views and events, no identify call
      analytics.page();
      console.log('✅ Analytics: Tracking behavior only (no user identification)');
      this.isInitialized = true;
    } catch (error) {
      console.error('❌ Analytics: Failed to track behavior:', error);
    }
  }

  /**
   * Track an event (safe for both identified and anonymous users)
   */
  trackEvent(eventName: string, properties?: Record<string, any>): void {
    const analytics = this.getAnalyticsInstance();
    if (!analytics || !this.isInitialized) return;

    try {
      analytics.track(eventName, properties);
    } catch (error) {
      console.error('❌ Analytics: Failed to track event:', error);
    }
  }

  /**
   * Track a page view (safe for both identified and anonymous users)
   */
  trackPageView(pageName?: string, properties?: Record<string, any>): void {
    const analytics = this.getAnalyticsInstance();
    if (!analytics) return;

    try {
      analytics.page(pageName, properties);
    } catch (error) {
      console.error('❌ Analytics: Failed to track page view:', error);
    }
  }

  /**
   * Clear analytics state (for logout)
   */
  reset(): void {
    this.isInitialized = false;
    console.log('🔄 Analytics: State reset');
  }
}

export const analytics = new AnalyticsService();

// Safeguard to intercept direct analytics calls and route them through our safe service
if (typeof window !== 'undefined') {
  const originalAnalytics = (window as any).analytics;
  const originalRudderAnalytics = (window as any).rudderanalytics;
  
  // Override window.analytics.identify to use our safe implementation
  const safeAnalyticsProxy = {
    identify: (userId: string, traits: Record<string, any>) => {
      console.warn('⚠️ Direct analytics.identify() call intercepted - using safe implementation');
      console.log('🔍 Direct identify call with traits:', traits);
      
      // Don't call identify if we don't have minimum required fields
      const hasEmailOrPhone = (traits.email && traits.email.trim()) || (traits.phone && traits.phone.trim());
      const hasAdditionalField = (traits.firstName && traits.firstName.trim()) || 
                                 (traits.lastName && traits.lastName.trim()) || 
                                 (traits.postalCode && traits.postalCode.trim()) || 
                                 (traits.country && traits.country.trim());
      
      console.log('🔍 Direct identify validation:', {
        hasEmailOrPhone,
        hasAdditionalField,
        willExecute: hasEmailOrPhone && hasAdditionalField
      });
      
      if (hasEmailOrPhone && hasAdditionalField) {
        console.log('✅ Direct identify: Executing with sufficient data');
        // Only call original if we have required fields
        if (originalAnalytics?.identify) {
          originalAnalytics.identify(userId, traits);
        }
        if (originalRudderAnalytics?.identify) {
          originalRudderAnalytics.identify(userId, traits);
        }
      } else {
        console.log('🚫 Skipping direct identify call - insufficient data for Google Ads requirements');
        console.log('🚫 Required: (email OR phone) AND (firstName OR lastName OR postalCode OR country)');
      }
    },
    track: (event: string, properties?: Record<string, any>) => {
      if (originalAnalytics?.track) originalAnalytics.track(event, properties);
      if (originalRudderAnalytics?.track) originalRudderAnalytics.track(event, properties);
    },
    page: (name?: string, properties?: Record<string, any>) => {
      if (originalAnalytics?.page) originalAnalytics.page(name, properties);
      if (originalRudderAnalytics?.page) originalRudderAnalytics.page(name, properties);
    }
  };

  // Override both possible analytics objects
  if (originalAnalytics) {
    (window as any).analytics = { ...originalAnalytics, ...safeAnalyticsProxy };
  }
  if (originalRudderAnalytics) {
    (window as any).rudderanalytics = { ...originalRudderAnalytics, ...safeAnalyticsProxy };
  }

  // Set up a periodic check to override analytics when it gets loaded
  const setupAnalyticsOverride = () => {
    const currentAnalytics = (window as any).analytics;
    const currentRudder = (window as any).rudderanalytics;
    
    if (currentAnalytics && !currentAnalytics._safeOverrideApplied) {
      (window as any).analytics = { ...currentAnalytics, ...safeAnalyticsProxy, _safeOverrideApplied: true };
      console.log('✅ Analytics safe override applied');
    }
    
    if (currentRudder && !currentRudder._safeOverrideApplied) {
      (window as any).rudderanalytics = { ...currentRudder, ...safeAnalyticsProxy, _safeOverrideApplied: true };
      console.log('✅ RudderStack safe override applied');
    }
  };

  // Apply override immediately and periodically for dynamic loading
  setupAnalyticsOverride();
  const intervalId = setInterval(setupAnalyticsOverride, 1000); // Check every second for the first 10 seconds
  setTimeout(() => {
    clearInterval(intervalId);
  }, 10000);
}