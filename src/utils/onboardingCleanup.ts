/**
 * Cleanup utility for onboarding-related storage and state
 */

export function clearOnboardingState(userId?: string) {
  console.log('🧹 Clearing onboarding state for user:', userId);
  
  // Clear session storage flags
  sessionStorage.removeItem('onboarding-checked');
  sessionStorage.removeItem('onboarding-completing');
  
  if (userId) {
    // Clear user-specific localStorage flags
    localStorage.removeItem(`onboarding-has-completed:${userId}`);
    localStorage.removeItem(`garden-center-onboarding-${userId}`);
    localStorage.removeItem(`onboarding-progress-${userId}`);
  }
  
  // Clean up legacy global flags
  localStorage.removeItem('onboarding-has-completed');
  localStorage.removeItem('dashboardTourDone');
  localStorage.removeItem('calendarOnboard');
  
  console.log('✅ Onboarding state cleared');
}

export function clearAllOnboardingFlags() {
  console.log('🧹 Clearing ALL onboarding flags...');
  
  // Clear all localStorage keys that match onboarding patterns
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (
      key.includes('onboarding') || 
      key.includes('dashboardTour') ||
      key.includes('garden-center-onboarding')
    )) {
      keysToRemove.push(key);
    }
  }
  
  keysToRemove.forEach(key => localStorage.removeItem(key));
  
  // Clear session storage
  sessionStorage.removeItem('onboarding-checked');
  sessionStorage.removeItem('onboarding-completing');
  
  console.log('✅ All onboarding flags cleared');
}