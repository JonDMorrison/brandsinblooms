
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/hooks/useTenant';

interface PostConnectionFlowState {
  isFirstTimeConnection: boolean;
  shouldShowOnboarding: boolean;
  hasApprovedContent: boolean;
  targetSection: 'ready-to-post' | 'weekly-content' | null;
}

export const usePostConnectionFlow = () => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const navigate = useNavigate();
  
  const [flowState, setFlowState] = useState<PostConnectionFlowState>({
    isFirstTimeConnection: false,
    shouldShowOnboarding: false,
    hasApprovedContent: false,
    targetSection: null
  });

  // Check if user just completed OAuth
  const checkOAuthCompletion = () => {
    const oauthCompleted = sessionStorage.getItem('oauth_just_completed');
    const hasSeenOnboarding = localStorage.getItem(`social_onboarding_completed_${user?.id}`);
    
    console.log('🔍 Checking OAuth completion:', {
      oauthCompleted,
      hasSeenOnboarding,
      userId: user?.id
    });
    
    return oauthCompleted === 'true' && !hasSeenOnboarding;
  };

  // Check for approved content
  const checkApprovedContent = async () => {
    if (!user || !tenant) {
      console.log('⏭️ Skipping content check - no user or tenant');
      return false;
    }

    try {
      console.log('📋 Checking for approved content...');
      
      const { data, error } = await supabase
        .from('content_tasks')
        .select('id')
        .eq('tenant_id', tenant.id)
        .eq('status', 'approved')
        .limit(1);

      if (error) {
        console.error('❌ Error checking approved content:', error);
        return false;
      }

      const hasContent = data && data.length > 0;
      console.log('📊 Approved content check result:', { hasContent, count: data?.length || 0 });
      
      return hasContent;
    } catch (error) {
      console.error('❌ Error checking approved content:', error);
      return false;
    }
  };

  // Initialize flow state
  useEffect(() => {
    const initializeFlow = async () => {
      if (!user || !tenant) {
        console.log('⏭️ Skipping flow initialization - no user or tenant');
        return;
      }

      console.log('🎯 Initializing post-connection flow...');

      const isFirstTime = checkOAuthCompletion();
      const hasApproved = await checkApprovedContent();

      const targetSection: 'ready-to-post' | 'weekly-content' | null = isFirstTime 
        ? (hasApproved ? 'ready-to-post' : 'weekly-content') 
        : null;

      const newFlowState: PostConnectionFlowState = {
        isFirstTimeConnection: isFirstTime,
        shouldShowOnboarding: isFirstTime,
        hasApprovedContent: hasApproved,
        targetSection
      };

      console.log('📊 Flow state initialized:', newFlowState);

      setFlowState(newFlowState);

      // If this is first time connection, automatically navigate to target section
      if (isFirstTime) {
        console.log('🎯 First time connection detected, will navigate to target section');
        setTimeout(() => {
          navigateToTargetSection();
        }, 1000); // Small delay to ensure page is loaded
      }
    };

    initializeFlow();
  }, [user, tenant]);

  // Navigate to target section
  const navigateToTargetSection = () => {
    if (!flowState.targetSection) {
      console.log('⏭️ No target section to navigate to');
      return;
    }

    console.log('🧭 Navigating to target section:', flowState.targetSection);

    // Clear OAuth completion flag
    sessionStorage.removeItem('oauth_just_completed');
    localStorage.removeItem('oauth_state_backup');

    // Navigate to home page and scroll to section
    navigate('/', { replace: true });
    
    setTimeout(() => {
      const sectionId = flowState.targetSection === 'ready-to-post' 
        ? 'ready-to-post-section' 
        : 'weekly-content-section';
      
      console.log('📍 Looking for section element:', sectionId);
      
      const element = document.querySelector(`[data-section="${sectionId}"]`);
      if (element) {
        console.log('✅ Found section element, scrolling...');
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        console.warn('⚠️ Section element not found:', sectionId);
        // Fallback: just ensure we're at the top of the page
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 500);
  };

  // Complete onboarding
  const completeOnboarding = () => {
    if (user) {
      console.log('✅ Completing onboarding for user:', user.id);
      localStorage.setItem(`social_onboarding_completed_${user.id}`, 'true');
      setFlowState(prev => ({ ...prev, shouldShowOnboarding: false }));
    }
  };

  // Trigger flow manually (for testing)
  const triggerFlow = () => {
    console.log('🧪 Manually triggering post-connection flow');
    sessionStorage.setItem('oauth_just_completed', 'true');
    if (user) {
      localStorage.removeItem(`social_onboarding_completed_${user.id}`);
    }
    window.location.reload();
  };

  return {
    flowState,
    navigateToTargetSection,
    completeOnboarding,
    triggerFlow
  };
};
