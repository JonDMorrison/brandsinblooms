
import React from 'react';
import { DevSocialPage } from '@/components/social/DevSocialPage';
import { SocialErrorBoundary } from '@/components/social/SocialErrorBoundary';

const DevSocialPageWrapper = () => {
  console.log('🚀 DevSocialPageWrapper: Component rendering');
  console.log('🚀 DevSocialPageWrapper: Window location:', window.location.pathname);
  
  try {
    return (
      <SocialErrorBoundary>
          <div className="min-h-screen bg-gray-50">
            {/* Dev Mode indicator in top right */}
            <div className="fixed top-4 right-6 z-50">
              <div className="bg-white rounded-lg shadow-sm border p-2">
                <div className="text-xs text-gray-500">Dev Mode</div>
              </div>
            </div>
            
            <div className="p-6">
              <DevSocialPage />
            </div>
          </div>
      </SocialErrorBoundary>
    );
  } catch (error) {
    console.error('🚨 DevSocialPageWrapper: Error rendering:', error);
    
    // Fallback UI without sidebar
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <h2 className="text-red-800 font-medium">Loading Error</h2>
            <p className="text-red-600 text-sm mt-1">
              There was an issue loading the sidebar. Showing page without sidebar.
            </p>
          </div>
          <SocialErrorBoundary>
            <DevSocialPage />
          </SocialErrorBoundary>
        </div>
      </div>
    );
  }
};

export default DevSocialPageWrapper;
