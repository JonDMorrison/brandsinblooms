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
 */
export async function checkProviderReadiness(): Promise<ProviderReadiness> {
  const result: ProviderReadiness = {
    email: { ready: false },
    sms: { ready: false },
    pos: { cartEventsEnabled: false }
  };

  try {
    // Check email readiness (Resend domain verification)
    const { data: emailSenders } = await supabase
      .from('email_senders')
      .select('verified')
      .eq('verified', true)
      .limit(1);

    if (emailSenders && emailSenders.length > 0) {
      result.email.ready = true;
    } else {
      // Fallback: check company profile DNS records
      const { data: companyProfile } = await supabase
        .from('company_profiles')
        .select('dns_records_verified')
        .single();

      if (companyProfile?.dns_records_verified) {
        result.email.ready = true;
      } else {
        result.email.reason = 'Email domain not verified. Please verify your sending domain in Settings.';
      }
    }

    // Check SMS readiness (Twilio configuration)
    // For now, assume SMS is ready if we don't error out
    // TODO: Add proper Twilio configuration fields to company_profiles
    result.sms.ready = true; // Placeholder - implement proper Twilio check
    if (!result.sms.ready) {
      result.sms.reason = 'Twilio SMS not configured. Please set up SMS in Settings.';
    }

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
    result.email.reason = 'Unable to verify email setup';
    result.sms.reason = 'Unable to verify SMS setup';
    result.pos.reason = 'Unable to verify POS setup';
  }

  return result;
}

/**
 * Checks if an automation can be activated based on its workflow steps and provider readiness
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

  // Check email provider readiness
  if (compilation.hasEmailSteps && !providers.email.ready) {
    blockedReasons.push(providers.email.reason || 'Email provider not ready');
  }

  // Check SMS provider readiness
  if (compilation.hasSMSSteps && !providers.sms.ready) {
    blockedReasons.push(providers.sms.reason || 'SMS provider not ready');
  }

  // Check POS cart events for abandoned_cart trigger
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
      title: 'Email Setup Required',
      description: 'Verify your sending domain to enable email automations.',
      ctaText: 'Set up Email',
      ctaLink: '/settings/email'
    },
    sms: {
      title: 'SMS Setup Required',
      description: 'Configure Twilio to enable SMS automations.',
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