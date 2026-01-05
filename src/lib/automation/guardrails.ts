import { supabase } from '@/integrations/supabase/client';
import { compileFlow, WorkflowStep } from './compiler';

export interface ProviderReadiness {
  email: {
    ready: boolean;
    reason?: string;
  };
  sms: {
    ready: boolean;
    reason?: string;
  };
  pos: {
    cartEventsEnabled: boolean;
    reason?: string;
  };
}

export interface ActivationGuard {
  canActivate: boolean;
  blockedReasons: string[];
  warnings: string[];
}

/**
 * Checks provider readiness for email, SMS, and POS features
 * Note: Email is always ready (fallback sender available)
 * SMS availability is checked but doesn't block automation - steps will be skipped at runtime
 */
export async function checkProviderReadiness(): Promise<ProviderReadiness> {
  const result: ProviderReadiness = {
    email: { ready: true }, // Email always has fallback sender
    sms: { ready: false },
    pos: { cartEventsEnabled: false }
  };

  try {
    // Email is always ready because we have fallback senders
    // Check for custom domain for display purposes
    const { data: emailSenders } = await supabase
      .from('email_senders')
      .select('verified')
      .eq('verified', true)
      .limit(1);

    if (emailSenders && emailSenders.length > 0) {
      result.email.ready = true;
    } else {
      const { data: companyProfile } = await supabase
        .from('company_profiles')
        .select('dns_records_verified')
        .single();

      if (companyProfile?.dns_records_verified) {
        result.email.ready = true;
      }
    }
    // Email always stays ready = true regardless, just for display info

    // Check SMS readiness (Twilio configuration)
    // For frontend, we assume SMS is NOT ready unless we can verify
    // The backend will do the actual check and skip if not configured
    // For now, mark as "unknown" and let backend handle gracefully
    result.sms.ready = false; // Conservative default - backend will skip if not configured
    result.sms.reason = 'SMS steps will be skipped if Twilio is not configured';

    // Check POS cart events feature flag
    const { data: posConfig } = await supabase
      .from('company_profiles')
      .select('feature_flags')
      .single();

    const cartEnabled = posConfig?.feature_flags?.['pos']?.['cart']?.['enabled'] === true;
    result.pos.cartEventsEnabled = cartEnabled;
    if (!cartEnabled) {
      result.pos.reason = 'POS cart events not enabled. Please enable cart tracking in POS Settings.';
    }

  } catch (error) {
    console.error('Error checking provider readiness:', error);
    // Email always stays ready
    result.sms.reason = 'Unable to verify SMS setup - steps will be skipped if unavailable';
    result.pos.reason = 'Unable to verify POS setup';
  }

  return result;
}

/**
 * Checks if an automation can be activated based on its workflow steps and provider readiness
 * 
 * IMPORTANT: Automations are now ALLOWED to activate even if some channels are not configured.
 * Unconfigured channel steps will be automatically skipped at runtime.
 */
export async function checkActivationGuards(
  flowState: { nodes: any[]; edges: any[] },
  triggerType: string
): Promise<ActivationGuard> {
  const compilation = compileFlow(flowState);
  const providers = await checkProviderReadiness();
  const blockedReasons: string[] = [];
  const warnings: string[] = [];

  // Check compilation warnings and errors
  if (compilation.warnings.length > 0) {
    warnings.push(...compilation.warnings);
  }

  if (compilation.steps.length === 0) {
    blockedReasons.push('Automation must contain at least one email or SMS step');
  }

  // SMS provider not ready -> WARNING (not blocking)
  // Steps will be skipped at runtime if SMS is not configured
  if (compilation.hasSMSSteps && !providers.sms.ready) {
    warnings.push('SMS steps will be automatically skipped if Twilio is not configured');
  }

  // Email is always available with fallback, no need to warn

  // Check POS cart events for abandoned_cart trigger - this IS blocking
  // because we can't trigger without cart events
  if (triggerType === 'abandoned_cart' && !providers.pos.cartEventsEnabled) {
    blockedReasons.push(providers.pos.reason || 'Abandoned cart requires POS cart events to be enabled');
  }

  // Check for empty content in steps
  compilation.steps.forEach((step, index) => {
    if (!step.text?.trim()) {
      blockedReasons.push(`Step ${index + 1} (${step.type}) has no content`);
    }
    
    if (step.type === 'email' && !step.subject?.trim()) {
      blockedReasons.push(`Email step ${index + 1} has no subject`);
    }
  });

  return {
    canActivate: blockedReasons.length === 0,
    blockedReasons,
    warnings
  };
}

/**
 * Gets user-friendly provider setup links and messages
 */
export function getProviderSetupInfo() {
  return {
    email: {
      title: 'Email Setup (Optional)',
      description: 'Custom domain improves deliverability. Fallback sender is always available.',
      ctaText: 'Set up Email',
      ctaLink: '/settings/email'
    },
    sms: {
      title: 'SMS Setup (Optional)',
      description: 'Configure Twilio to enable SMS steps. Without it, SMS steps will be skipped.',
      ctaText: 'Set up SMS',
      ctaLink: '/settings/sms'
    },
    pos: {
      title: 'POS Cart Events Required',
      description: 'Enable cart tracking in your POS integration for abandoned cart recovery.',
      ctaText: 'Configure POS',
      ctaLink: '/settings/integrations/pos'
    }
  };
}

/**
 * Generates workflow step statistics for UI display
 */
export function getWorkflowStats(steps: WorkflowStep[]): {
  emailCount: number;
  smsCount: number;
  totalSteps: number;
  estimatedDuration: string;
} {
  const emailCount = steps.filter(s => s.type === 'email').length;
  const smsCount = steps.filter(s => s.type === 'sms').length;
  const totalSteps = steps.length;
  
  // Calculate estimated duration based on max delay
  const maxDelayMin = Math.max(...steps.map(s => s.delayMin), 0);
  let estimatedDuration = 'Immediate';
  
  if (maxDelayMin > 0) {
    if (maxDelayMin >= 1440) {
      const days = Math.ceil(maxDelayMin / 1440);
      estimatedDuration = `${days} day${days > 1 ? 's' : ''}`;
    } else if (maxDelayMin >= 60) {
      const hours = Math.ceil(maxDelayMin / 60);
      estimatedDuration = `${hours} hour${hours > 1 ? 's' : ''}`;
    } else {
      estimatedDuration = `${maxDelayMin} minute${maxDelayMin > 1 ? 's' : ''}`;
    }
  }

  return {
    emailCount,
    smsCount,
    totalSteps,
    estimatedDuration
  };
}
