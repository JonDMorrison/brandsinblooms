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
    // Check if we have email/phone AND at least one of: firstName, lastName, postalCode, country
    const hasEmailOrPhone = userData.email || userData.phone;
    const hasAdditionalField = userData.firstName || userData.lastName || userData.postalCode || userData.country;
    
    return !!(hasEmailOrPhone && hasAdditionalField);
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

    return this.hasMinimumRequiredFields(userData) ? userData : null;
  }

  /**
   * Initialize analytics for an authenticated user
   * Only calls identify if we have the minimum required fields
   */
  identifyUser(user: User): void {
    const analytics = this.getAnalyticsInstance();
    if (!analytics) return;

    const userData = this.extractUserData(user);
    
    if (userData) {
      try {
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