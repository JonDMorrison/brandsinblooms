/**
 * Email Domains Configuration
 * Centralized configuration for email domain setup including Entri Connect integration
 */

export const emailDomainsConfig = {
  // Entri Connect configuration
  entriEnabled: true,
  entriAppId: 'bloomsuite',
  entriScriptUrl: 'https://cdn.goentri.com/entri.js',
  
  // Feature flags
  autoSetupRecommended: true,
  
  // Validation
  isEntriConfigured(): boolean {
    return this.entriEnabled && this.entriAppId.length > 0 && this.entriAppId !== 'YOUR_ENTRI_APP_ID';
  },
};
