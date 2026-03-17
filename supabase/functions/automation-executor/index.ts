import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import { renderMergeTags, convertLegacyTags, createMergeTagDataFromCustomer, GLOBAL_FALLBACKS } from "../_shared/mergeTagEngine.ts";
import { resolveSender, type SenderConfig } from "../_shared/senderResolver.ts";
import { checkChannelAvailability, isChannelAvailable, type ChannelAvailability } from "../_shared/channelAvailability.ts";
import { logActivityEvent } from "../_shared/activityLogger.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AutomationTriggerEvent {
  trigger_type: string;
  tenant_id: string;
  customer_id: string;
  data: Record<string, any>;
}

interface WorkflowStep {
  type: 'email' | 'sms';
  delayMin: number;
  subject?: string;
  text: string;
}

// Parse delay string like "1 day", "2 hours", "30 minutes" to minutes
function parseDelayToMinutes(delay: string | number): number {
  if (typeof delay === 'number') return delay;
  if (!delay || delay === 'Immediate') return 0;

  const lower = delay.toLowerCase();
  const match = lower.match(/(\d+)\s*(minute|hour|day|week)/);
  if (!match) return 0;

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 'minute': return value;
    case 'hour': return value * 60;
    case 'day': return value * 60 * 24;
    case 'week': return value * 60 * 24 * 7;
    default: return 0;
  }
}

// Parse delay from various step formats to minutes
function parseStepDelay(step: any): number {
  // If delayMin already exists as a number, use it
  if (typeof step.delayMin === 'number' && !isNaN(step.delayMin)) {
    return step.delayMin;
  }

  // Handle delayValue + delayUnit format (e.g., {delayValue: 2, delayUnit: "days"})
  if (step.delayValue !== undefined && step.delayUnit) {
    const value = parseInt(step.delayValue, 10) || 0;
    switch (step.delayUnit) {
      case 'minutes': return value;
      case 'hours': return value * 60;
      case 'days': return value * 60 * 24;
      case 'weeks': return value * 60 * 24 * 7;
      default: return 0;
    }
  }

  // Handle delay string format (e.g., "24 hours", "Immediate")
  if (step.delay !== undefined) {
    return parseDelayToMinutes(step.delay);
  }

  return 0; // Default to immediate
}

// Normalize workflow_steps from either array format or React Flow object format
function normalizeWorkflowSteps(workflowSteps: any): WorkflowStep[] {
  // If it's already an array, parse each step properly
  if (Array.isArray(workflowSteps)) {
    console.log(`🔄 Normalizing array format (${workflowSteps.length} steps)`);

    // Calculate cumulative delays from delay nodes
    let cumulativeDelayFromDelayNodes = 0;
    const normalizedSteps: WorkflowStep[] = [];

    for (const step of workflowSteps) {
      // If this is a delay-type node, accumulate it for the next message step
      if (step.type === 'delay') {
        cumulativeDelayFromDelayNodes += parseStepDelay(step);
        continue;
      }

      // Only process email and sms steps
      if (step.type === 'email' || step.type === 'sms') {
        const stepDelay = parseStepDelay(step);
        const totalDelay = stepDelay + cumulativeDelayFromDelayNodes;

        normalizedSteps.push({
          type: step.type as 'email' | 'sms',
          delayMin: totalDelay,
          subject: step.subject || '',
          text: step.content || step.text || ''
        });

        // Reset cumulative delay after applying to a message step
        cumulativeDelayFromDelayNodes = 0;
      }
    }

    console.log(`📋 Normalized ${normalizedSteps.length} message steps from array`);
    return normalizedSteps;
  }

  // If it's React Flow format with nodes/edges
  if (workflowSteps && typeof workflowSteps === 'object' && Array.isArray(workflowSteps.nodes)) {
    console.log(`🔄 Converting React Flow format (${workflowSteps.nodes.length} nodes)`);
    return workflowSteps.nodes
      .filter((node: any) => node.type === 'email' || node.type === 'sms')
      .map((node: any) => {
        const delayMin = node.data?.delay ? parseDelayToMinutes(node.data.delay) : 0;
        return {
          type: node.type as 'email' | 'sms',
          delayMin,
          subject: node.data?.subject || '',
          text: node.data?.content || node.data?.text || ''
        };
      });
  }

  // Fallback: return empty array
  console.log(`⚠️ Unknown workflow_steps format, returning empty array`);
  return [];
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Allow calls with apikey header (for pg_cron) or standard Authorization
    const authHeader = req.headers.get('Authorization');
    const apiKey = req.headers.get('apikey');

    // If neither auth header nor apikey, check for service role in request
    if (!authHeader && !apiKey) {
      // For now, allow unauthenticated calls since this runs via cron
      // The function uses service role key internally anyway
      console.log('⚠️ No auth header, proceeding with service role');
    }

    console.log('🤖 Automation Executor starting...');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Query active automations with workflow_steps
    const { data: activeAutomations, error: automationsError } = await supabase
      .from('crm_automations')
      .select(`
        id,
        tenant_id,
        user_id,
        trigger_type,
        trigger_conditions,
        workflow_steps,
        name,
        version
      `)
      .eq('is_active', true);

    if (automationsError) {
      console.error('❌ Failed to fetch active automations:', automationsError);
      throw automationsError;
    }

    console.log(`📋 Found ${activeAutomations?.length || 0} active automations`);

    let totalProcessed = 0;
    let totalEnqueued = 0;

    // 1.5. Process pending trigger events from the queue (real-time segment/persona triggers)
    const { eventsProcessed, eventsEnqueued } = await processPendingTriggerEvents(supabase);
    totalProcessed += eventsProcessed;
    totalEnqueued += eventsEnqueued;

    // 2. Process each automation (for time-based triggers like loyalty_join, birthday, etc.)
    for (const automation of activeAutomations || []) {
      // Skip event-driven triggers - they're handled by webhooks or the event queue, NOT cron
      const eventDrivenTriggers = [
        'segment.added', 'segment_added',
        'persona.assigned', 'persona_assigned',
        'payment.completed', 'first_purchase',
        'contact.created',
      ];
      if (eventDrivenTriggers.includes(automation.trigger_type)) {
        continue;
      }

      console.log(`🔄 Processing automation: ${automation.name} (${automation.trigger_type})`);

      try {
        // Check provider readiness before processing
        const providerCheck = await checkProviderReadiness(supabase, automation);
        if (!providerCheck.canProcess) {
          console.log(`⚠️ Skipping automation ${automation.name}: ${providerCheck.reason}`);
          continue;
        }

        const { processed, enqueued } = await processAutomation(supabase, automation);
        totalProcessed += processed;
        totalEnqueued += enqueued;
      } catch (error) {
        console.error(`❌ Error processing automation ${automation.id}:`, error);
      }
    }

    console.log(`✅ Automation execution complete. Processed: ${totalProcessed}, Enqueued: ${totalEnqueued}`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: totalProcessed,
        enqueued: totalEnqueued,
        timestamp: new Date().toISOString()
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );

  } catch (error) {
    console.error('💥 Automation executor error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

async function checkProviderReadiness(supabase: any, automation: any): Promise<{ canProcess: boolean; reason?: string; senderConfig?: SenderConfig; channelAvailability?: ChannelAvailability }> {
  const workflowSteps: WorkflowStep[] = normalizeWorkflowSteps(automation.workflow_steps);
  const hasEmailSteps = workflowSteps.some(step => step.type === 'email');
  const hasSMSSteps = workflowSteps.some(step => step.type === 'sms');

  // Check channel availability
  const channels = checkChannelAvailability();
  console.log(`📊 [ProviderCheck] Channel availability: Email=${channels.email.available}, SMS=${channels.sms.available}`);

  if (hasSMSSteps && !channels.sms.available) {
    console.log(`⚠️ Automation has SMS steps but SMS is not configured (${channels.sms.reason}). SMS steps will be skipped.`);
  }

  // Check company profile (legacy flags)
  // NOTE: company_profiles is user-scoped (no tenant_id column).
  let companyProfile: any = null;
  if (automation.user_id) {
    const { data, error: profileError } = await supabase
      .from('company_profiles')
      .select('feature_flags')
      .eq('user_id', automation.user_id)
      .maybeSingle();

    if (profileError && profileError.code !== 'PGRST116') {
      console.error(`❌ Error fetching company profile for user ${automation.user_id}:`, profileError);
    } else {
      companyProfile = data;
    }
  }

  // Check Email provider readiness using senderResolver (always available with fallback)
  let senderConfig: SenderConfig | undefined;
  if (hasEmailSteps) {
    try {
      senderConfig = await resolveSender(supabase, automation.tenant_id, {});
      console.log(`📧 [ProviderCheck] Email sender resolved: ${senderConfig.deliveryMethod} (${senderConfig.fromEmail})`);
      // Email is always ready because we have fallback senders
    } catch (error) {
      console.error(`❌ Error resolving sender for tenant ${automation.tenant_id}:`, error);
      return { canProcess: false, reason: 'Failed to resolve email sender' };
    }
  }

  // Check POS cart events for abandoned_cart trigger - this IS blocking
  if (automation.trigger_type === 'abandoned_cart') {
    const posCartEnabled = companyProfile?.feature_flags?.['pos']?.['cart']?.['enabled'] === true;
    if (!posCartEnabled) {
      return { canProcess: false, reason: 'POS cart events not enabled' };
    }
  }

  // Always allow processing - unconfigured channels will be skipped at runtime
  return { canProcess: true, senderConfig, channelAvailability: channels };
}

async function processAutomation(supabase: any, automation: any) {
  let processed = 0;
  let enqueued = 0;

  try {
    // Get workflow steps (handles both array and React Flow formats)
    const workflowSteps: WorkflowStep[] = normalizeWorkflowSteps(automation.workflow_steps);
    if (workflowSteps.length === 0) {
      console.log(`⚠️ No workflow steps defined for automation ${automation.id}`);
      return { processed: 0, enqueued: 0 };
    }

    // Get eligible customers based on trigger type
    const eligibleCustomers = await getEligibleCustomers(supabase, automation);
    console.log(`👥 Found ${eligibleCustomers.length} eligible customers for ${automation.trigger_type}`);

    for (const customer of eligibleCustomers) {
      try {
        // Check if this customer already has an active OR recently completed automation run
        const { data: existingRun } = await supabase
          .from('automation_runs')
          .select('id, status, run_sequence, next_step_scheduled_at, completed_at')
          .eq('automation_id', automation.id)
          .eq('customer_id', customer.id)
          .in('status', ['active', 'paused'])
          .order('run_sequence', { ascending: false })
          .limit(1)
          .maybeSingle();

        // Also check for recently completed runs (within 24h) to prevent cron re-triggering
        if (!existingRun) {
          const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
          const { data: recentlyCompleted } = await supabase
            .from('automation_runs')
            .select('id')
            .eq('automation_id', automation.id)
            .eq('customer_id', customer.id)
            .eq('status', 'completed')
            .gte('completed_at', oneDayAgo)
            .limit(1)
            .maybeSingle();

          if (recentlyCompleted) {
            console.log(`⏭️ Skipping customer ${customer.email} - automation already completed within 24h (cooldown)`);
            continue;
          }
        }

        // Always compute a safe next run sequence number (even if no active run)
        // to avoid unique violations when re-triggering after a completed run.
        const { data: maxSeqData } = await supabase
          .from('automation_runs')
          .select('run_sequence')
          .eq('automation_id', automation.id)
          .eq('customer_id', customer.id)
          .order('run_sequence', { ascending: false })
          .limit(1)
          .maybeSingle();

        // Handle overlapping automations based on overlap_behavior setting
        const overlapBehavior = automation.overlap_behavior || 'ignore';
        let nextRunSequence = (maxSeqData?.run_sequence || 0) + 1;

        if (existingRun) {
          switch (overlapBehavior) {
            case 'ignore':
              console.log(`⏭️ Skipping customer ${customer.email} - already has active run (ignore mode)`);
              continue;

            case 'restart':
              console.log(`🔄 Restarting automation for ${customer.email} (cancelling existing run)`);
              // Cancel the existing run
              await supabase
                .from('automation_runs')
                .update({
                  status: 'cancelled',
                  error_message: 'Cancelled due to re-trigger (restart mode)',
                  completed_at: new Date().toISOString()
                })
                .eq('id', existingRun.id);
              // Skip any pending messages for the cancelled run
              await supabase
                .from('crm_outbox')
                .update({
                  status: 'skipped',
                  skip_reason: 'Run restarted',
                  skipped_at: new Date().toISOString()
                })
                .eq('automation_run_id', existingRun.id)
                .eq('status', 'queued');
              break;

            case 'parallel':
              console.log(`🔀 Creating parallel run for ${customer.email} (sequence: ${nextRunSequence})`);
              break;

            case 'queue':
              // Queue mode not supported for batch processing - skip
              console.log(`⏭️ Skipping customer ${customer.email} - queue mode not supported for batch processing`);
              continue;

            default:
              console.log(`⏭️ Skipping customer ${customer.email} - already has active run`);
              continue;
          }
        }

        // Create new automation run with sequence number
        const runId = await createAutomationRun(supabase, automation, customer, workflowSteps.length, undefined, nextRunSequence);
        if (!runId) {
          console.error(`❌ Failed to create automation run for customer ${customer.id}`);
          continue;
        }

        // Schedule the first step
        const firstStep = workflowSteps[0];
        const scheduledAt = calculateScheduledTime(firstStep.delayMin, automation, customer);

        await enqueueMessage(supabase, automation, customer, firstStep, 0, runId, scheduledAt);

        // Update run with next scheduled time
        await supabase
          .from('automation_runs')
          .update({ next_step_scheduled_at: scheduledAt.toISOString() })
          .eq('id', runId);

        enqueued++;
        processed++;

      } catch (customerError) {
        console.error(`❌ Error processing customer ${customer.id}:`, customerError);
      }
    }

  } catch (error) {
    console.error(`❌ Error in processAutomation for ${automation.id}:`, error);
  }

  return { processed, enqueued };
}

async function createAutomationRun(
  supabase: any,
  automation: any,
  customer: any,
  totalSteps: number,
  channelAvailability?: ChannelAvailability,
  runSequence: number = 1
): Promise<string | null> {
  const channels = channelAvailability || checkChannelAvailability();

  async function tryInsert(sequence: number): Promise<{ id: string } | null> {
    const { data: inserted, error } = await supabase
      .from('automation_runs')
      .insert({
        automation_id: automation.id,
        customer_id: customer.id,
        tenant_id: automation.tenant_id,
        status: 'active',
        current_step_index: 0,
        total_steps: totalSteps,
        run_sequence: sequence,
        trigger_data: {
          trigger_type: automation.trigger_type,
          triggered_at: new Date().toISOString(),
          customer_email: customer.email,
        },
        metadata: {
          automation_name: automation.name,
          automation_version: automation.version,
          overlap_behavior: automation.overlap_behavior || 'ignore',
        },
        channel_availability: {
          email: { available: channels.email.available, reason: channels.email.reason },
          sms: { available: channels.sms.available, reason: channels.sms.reason },
        },
      })
      .select('id')
      .single();

    if (error) {
      // Surface unique violation so we can retry with a new sequence
      if (error.code === '23505') return null;
      throw error;
    }

    await logActivityEvent(supabase, {
      tenant_id: automation.tenant_id,
      customer_id: customer.id,
      actor_type: 'automation',
      source: 'automation',
      activity_type: 'automation.started',
      status: 'success',
      title: `Automation started: ${automation.name || 'Automation'}`,
      description: {
        parts: [
          { type: 'text', text: 'Automation run started.' },
        ],
      },
      metadata: {
        automation_id: automation.id,
        automation_run_id: inserted.id,
        run_sequence: sequence,
        trigger_type: automation.trigger_type,
        customer_name: `${customer.first_name ?? ''} ${customer.last_name ?? ''}`.trim() || customer.email || 'Customer',
        customer_first_name: customer.first_name ?? null,
        customer_last_name: customer.last_name ?? null,
      },
      related_entities: {
        automation_id: automation.id,
        automation_run_id: inserted.id,
        customer_id: customer.id,
      },
    });

    return inserted;
  }

  let run: { id: string } | null = null;
  try {
    run = await tryInsert(runSequence);
    if (!run) {
      // Unique violation: choose next available sequence and retry once.
      const { data: maxSeqData } = await supabase
        .from('automation_runs')
        .select('run_sequence')
        .eq('automation_id', automation.id)
        .eq('customer_id', customer.id)
        .order('run_sequence', { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextSequence = (maxSeqData?.run_sequence || 0) + 1;
      run = await tryInsert(nextSequence);
    }
  } catch (error) {
    console.error('❌ Failed to create automation run:', error);
    return null;
  }

  if (!run) {
    console.log(`⏭️ Customer ${customer.id} already has a run for automation ${automation.id} (sequence conflict)`);
    return null;
  }

  console.log(`📝 Created automation run ${run.id} for customer ${customer.email} (sequence: ${runSequence}, channels: email=${channels.email.available}, sms=${channels.sms.available})`);
  return run.id;
}

function calculateScheduledTime(delayMin: number, automation: any, customer: any): Date {
  // Ensure delayMin is a valid number to prevent Invalid Date errors
  const safeDelayMin = typeof delayMin === 'number' && !isNaN(delayMin) ? delayMin : 0;

  const baseTime = new Date();

  // Handle special trigger types with different base times
  if (automation.trigger_type === 'birthday' && customer.custom_fields?.date_of_birth) {
    const birthday = new Date(customer.custom_fields.date_of_birth);
    const currentYear = new Date().getFullYear();
    const thisYearBirthday = new Date(currentYear, birthday.getMonth(), birthday.getDate());

    // If birthday has passed this year, schedule for next year
    if (thisYearBirthday < new Date()) {
      thisYearBirthday.setFullYear(currentYear + 1);
    }

    return new Date(thisYearBirthday.getTime() + safeDelayMin * 60 * 1000);
  }

  // Default: schedule relative to now
  return new Date(baseTime.getTime() + safeDelayMin * 60 * 1000);
}

async function getEligibleCustomers(supabase: any, automation: any) {
  const { trigger_type, tenant_id } = automation;

  let query = supabase
    .from('crm_customers')
    .select('*')
    .eq('tenant_id', tenant_id);

  // Apply trigger-specific filters using canonical trigger IDs
  switch (trigger_type) {
    case 'loyalty_join':
    case 'loyalty.signup':
      // Customers who joined loyalty program in last 24 hours
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      query = query.gte('created_at', oneDayAgo);
      break;

    case 'first_purchase':
    case 'payment.completed':
      // Customers with recent purchase activity
      const purchaseWindow = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      query = query.gte('last_purchase_date', purchaseWindow.split('T')[0]);
      break;

    case 'repeat_purchase_90d':
      // Customers who haven't purchased in 90 days
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      query = query.lt('last_purchase_date', ninetyDaysAgo);
      break;

    case 'birthday':
    case 'purchase.anniversary':
      // Customers with birthday/anniversary today
      const today = new Date().toISOString().split('T')[0];
      query = query.like('custom_fields->date_of_birth', `%${today.slice(5)}%`);
      break;

    case 'abandoned_cart':
      // Customers with abandoned carts
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      query = query.gte('last_cart_abandoned_at', twoHoursAgo);
      break;

    case 'review_request':
      // Customers with purchase 5 days ago
      const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      query = query.eq('last_purchase_date', fiveDaysAgo);
      break;

    case 'contact.created':
      // New contacts created in last 24 hours
      const contactOneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      query = query.gte('created_at', contactOneDayAgo);
      break;

    case 'contact.updated':
      // Contacts updated in last 24 hours
      const updateOneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      query = query.gte('updated_at', updateOneDayAgo);
      break;

    case 'segment.added':
      // Handle segment-based triggers
      // Get the target segment ID from trigger_conditions
      const targetSegmentId = automation.trigger_conditions?.segment_id;
      if (!targetSegmentId) {
        console.log(`⚠️ No segment_id specified for segment.added trigger`);
        return [];
      }
      // Query customers who were added to this segment recently
      return await getCustomersAddedToSegment(supabase, tenant_id, targetSegmentId);

    case 'persona.assigned':
      // Handle persona-based triggers
      const targetPersonaId = automation.trigger_conditions?.persona_id;
      if (!targetPersonaId) {
        console.log(`⚠️ No persona_id specified for persona.assigned trigger`);
        return [];
      }
      // Query customers who were assigned this persona recently
      return await getCustomersAssignedToPersona(supabase, tenant_id, targetPersonaId);

    default:
      console.log(`⚠️ Trigger type ${trigger_type} not implemented yet`);
      return [];
  }

  const { data: customers, error } = await query;

  if (error) {
    console.error(`❌ Error fetching customers for ${trigger_type}:`, error);
    return [];
  }

  return customers || [];
}

async function enqueueMessage(
  supabase: any,
  automation: any,
  customer: any,
  step: WorkflowStep,
  stepIndex: number,
  runId: string,
  scheduledAt: Date
) {
  const recipient = step.type === 'sms' ? customer.phone : customer.email;

  // Check if recipient is missing
  if (!recipient) {
    console.log(`⚠️ No ${step.type} recipient for customer ${customer.email}, skipping step`);
    await skipStep(supabase, automation, customer, step, stepIndex, runId, `No ${step.type} recipient available`);
    return;
  }

  // Check if channel is available
  const channelStatus = isChannelAvailable(step.type);
  if (!channelStatus.available) {
    console.log(`⚠️ Channel ${step.type} not available: ${channelStatus.reason}, skipping step`);
    await skipStep(supabase, automation, customer, step, stepIndex, runId, channelStatus.reason || 'Channel not configured');
    return;
  }

  // Personalize message content
  const personalizedContent = personalizeMessage(step.text, customer, automation);
  const personalizedSubject = step.subject ? personalizeMessage(step.subject, customer, automation) : undefined;

  // Resolve sender for email steps
  let senderConfig: SenderConfig | null = null;
  if (step.type === 'email') {
    try {
      senderConfig = await resolveSender(supabase, automation.tenant_id, {});
      console.log(`📧 [Enqueue] Resolved sender: ${senderConfig.deliveryMethod} (${senderConfig.fromEmail})`);
    } catch (error) {
      console.error(`❌ Failed to resolve sender for tenant ${automation.tenant_id}:`, error);
    }
  }

  // Insert into outbox with automation_run_id and sender config
  const { error: outboxError } = await supabase
    .from('crm_outbox')
    .insert({
      tenant_id: automation.tenant_id,
      automation_id: automation.id,
      automation_run_id: runId,
      automation_node_id: step.id || step.node_id || `step-${stepIndex}`,
      customer_id: customer.id,
      message_type: step.type,
      recipient,
      content: personalizedContent,
      subject: personalizedSubject,
      step_index: stepIndex,
      template_data: {
        automation_name: automation.name,
        step_index: stepIndex,
        customer_data: customer,
        step_type: step.type,
        trigger_type: automation.trigger_type,
        // Include sender configuration for email processing
        sender_config: senderConfig ? {
          from_email: senderConfig.fromEmail,
          from_name: senderConfig.fromName,
          delivery_method: senderConfig.deliveryMethod,
          domain_id: senderConfig.domainId || null,
          reply_to: senderConfig.replyTo || senderConfig.fromEmail  // Include reply-to with sender fallback
        } : null
      },
      scheduled_at: scheduledAt.toISOString(),
      status: 'queued',  // Standardized: always use queued, scheduled_at determines when to process
      priority: 100,
    });

  if (outboxError) {
    console.error(`❌ Failed to enqueue message:`, {
      code: outboxError.code,
      message: outboxError.message,
      details: outboxError.details,
      hint: outboxError.hint,
      payload: {
        tenant_id: automation.tenant_id,
        automation_id: automation.id,
        customer_id: customer.id,
        message_type: step.type,
        recipient,
      }
    });
    throw outboxError;
  }

  console.log(`📬 [OUTBOX] Successfully inserted for customer ${customer.email}, type: ${step.type}`);

  // Log the automation step
  await supabase
    .from('crm_automation_logs')
    .insert({
      automation_id: automation.id,
      customer_id: customer.id,
      step_index: stepIndex,
      message_type: step.type,
      status: 'queued',
      created_at: new Date().toISOString()
    });

  console.log(`✅ Enqueued ${step.type} for ${customer.email} (step ${stepIndex + 1}, scheduled: ${scheduledAt.toISOString()}, sender: ${senderConfig?.deliveryMethod || 'sms'})`);
}

/**
 * Skip a step and log the skip reason, then schedule the next step
 */
async function skipStep(
  supabase: any,
  automation: any,
  customer: any,
  step: WorkflowStep,
  stepIndex: number,
  runId: string,
  reason: string
) {
  const now = new Date().toISOString();

  // Insert skipped entry into outbox for tracking
  await supabase
    .from('crm_outbox')
    .insert({
      tenant_id: automation.tenant_id,
      automation_id: automation.id,
      automation_run_id: runId,
      automation_node_id: step.id || step.node_id || `step-${stepIndex}`,
      customer_id: customer.id,
      message_type: step.type,
      recipient: step.type === 'sms' ? customer.phone : customer.email,
      content: step.text,
      subject: step.subject,
      step_index: stepIndex,
      scheduled_at: now,
      status: 'skipped',
      skip_reason: reason,
      skipped_at: now,
      priority: 100,
    });

  // Log the skip in automation logs
  await supabase
    .from('crm_automation_logs')
    .insert({
      automation_id: automation.id,
      customer_id: customer.id,
      step_index: stepIndex,
      message_type: step.type,
      status: reason.includes('recipient') ? 'skipped_no_recipient' : 'skipped_no_channel',
      skip_reason: reason,
      created_at: now
    });

  console.log(`⏭️ Skipped step ${stepIndex + 1} (${step.type}): ${reason}`);

  // Advance to next step
  await advanceAfterSkip(supabase, automation, customer, stepIndex, runId);
}

/**
 * Advance automation run to next step after a skip
 */
async function advanceAfterSkip(
  supabase: any,
  automation: any,
  customer: any,
  currentStepIndex: number,
  runId: string
) {
  // Get workflow steps
  const workflowSteps: WorkflowStep[] = normalizeWorkflowSteps(automation.workflow_steps);
  const nextStepIndex = currentStepIndex + 1;

  if (nextStepIndex >= workflowSteps.length) {
    // All steps completed (or skipped)
    await supabase
      .from('automation_runs')
      .update({
        status: 'completed',
        current_step_index: workflowSteps.length,
        completed_at: new Date().toISOString(),
        next_step_scheduled_at: null,
      })
      .eq('id', runId);

    console.log(`🎉 Automation run ${runId} completed (after skips)`);
    return;
  }

  // Schedule next step
  const nextStep = workflowSteps[nextStepIndex];
  const scheduledAt = calculateScheduledTime(nextStep.delayMin, automation, customer);

  // Update run state
  await supabase
    .from('automation_runs')
    .update({
      current_step_index: nextStepIndex,
      next_step_scheduled_at: scheduledAt.toISOString(),
    })
    .eq('id', runId);

  // Enqueue the next step (this will recursively skip if needed)
  await enqueueMessage(supabase, automation, customer, nextStep, nextStepIndex, runId, scheduledAt);
}

function personalizeMessage(template: string, customer: any, automation: any): string {
  // Convert legacy tags first
  let normalized = convertLegacyTags(template);

  // Create merge tag data from customer
  const mergeTagData = createMergeTagDataFromCustomer(customer, {
    company_name: 'Your Garden Center'
  });

  // Add automation-specific placeholders to system
  mergeTagData.system = {
    ...mergeTagData.system,
    unsubscribe_url: '#',
    preferences_url: '#',
    current_year: new Date().getFullYear().toString(),
    current_date: new Date().toLocaleDateString()
  };

  // Add custom automation data
  mergeTagData.custom = {
    ...mergeTagData.custom,
    points: String(customer.loyalty_points || 0),
    offer: '20% off your next purchase',
    expiry_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(),
    discount_code: 'WELCOME10',
    shop_url: 'https://example.com/shop',
    cart_url: `https://example.com/cart?restore=${customer.id}`,
    review_url: 'https://example.com/review',
    workshop_link: 'https://example.com/workshops'
  };

  // Render with unified engine
  return renderMergeTags(normalized, mergeTagData);
}

// Helper function to get customers recently added to a segment
async function getCustomersAddedToSegment(supabase: any, tenantId: string, segmentId: string) {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Query customer_segments junction table for recent additions
  const { data: segmentMembers, error: segmentError } = await supabase
    .from('customer_segments')
    .select('customer_id, created_at')
    .eq('segment_id', segmentId)
    .gte('created_at', oneDayAgo);

  if (segmentError) {
    console.error(`❌ Error fetching segment members:`, segmentError);
    return [];
  }

  if (!segmentMembers || segmentMembers.length === 0) {
    return [];
  }

  // Get full customer data for matched customers
  const customerIds = segmentMembers.map((m: any) => m.customer_id);
  const { data: customers, error: customersError } = await supabase
    .from('crm_customers')
    .select('*')
    .eq('tenant_id', tenantId)
    .in('id', customerIds);

  if (customersError) {
    console.error(`❌ Error fetching customers for segment:`, customersError);
    return [];
  }

  console.log(`📊 Found ${customers?.length || 0} customers added to segment ${segmentId} in last 24h`);
  return customers || [];
}

// Helper function to get customers recently assigned to a persona
async function getCustomersAssignedToPersona(supabase: any, tenantId: string, personaId: string) {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Query customer_personas junction table for recent assignments
  const { data: personaMembers, error: personaError } = await supabase
    .from('customer_personas')
    .select('customer_id, created_at')
    .eq('persona_id', personaId)
    .gte('created_at', oneDayAgo);

  if (personaError) {
    console.error(`❌ Error fetching persona members:`, personaError);
    return [];
  }

  if (!personaMembers || personaMembers.length === 0) {
    return [];
  }

  // Get full customer data for matched customers
  const customerIds = personaMembers.map((m: any) => m.customer_id);
  const { data: customers, error: customersError } = await supabase
    .from('crm_customers')
    .select('*')
    .eq('tenant_id', tenantId)
    .in('id', customerIds);

  if (customersError) {
    console.error(`❌ Error fetching customers for persona:`, customersError);
    return [];
  }

  console.log(`👤 Found ${customers?.length || 0} customers assigned to persona ${personaId} in last 24h`);
  return customers || [];
}

// Process pending trigger events from the automation_trigger_events queue
async function processPendingTriggerEvents(supabase: any): Promise<{ eventsProcessed: number; eventsEnqueued: number }> {
  let eventsProcessed = 0;
  let eventsEnqueued = 0;

  try {
    // Fetch unprocessed trigger events (including queued events whose queue time has passed)
    const now = new Date().toISOString();
    const { data: events, error: eventsError } = await supabase
      .from('automation_trigger_events')
      .select(`
        id,
        automation_id,
        customer_id,
        segment_id,
        persona_id,
        tenant_id,
        event_type,
        created_at,
        queued_until
      `)
      .is('processed_at', null)
      .or(`queued_until.is.null,queued_until.lte.${now}`)
      .order('created_at', { ascending: true })
      .limit(100);

    if (eventsError) {
      console.error('❌ Failed to fetch trigger events:', eventsError);
      return { eventsProcessed: 0, eventsEnqueued: 0 };
    }

    if (!events || events.length === 0) {
      console.log('📭 No pending trigger events to process');
      return { eventsProcessed: 0, eventsEnqueued: 0 };
    }

    console.log(`📬 Processing ${events.length} pending trigger events`);

    for (const event of events) {
      try {
        // Fetch the automation
        const { data: automation, error: automationError } = await supabase
          .from('crm_automations')
          .select('*')
          .eq('id', event.automation_id)
          .eq('is_active', true)
          .single();

        if (automationError || !automation) {
          console.log(`⚠️ Automation ${event.automation_id} not found or inactive, marking event as processed`);
          await markEventProcessed(supabase, event.id, 'Automation not found or inactive');
          continue;
        }

        // Fetch the customer
        const { data: customer, error: customerError } = await supabase
          .from('crm_customers')
          .select('*')
          .eq('id', event.customer_id)
          .single();

        if (customerError || !customer) {
          console.log(`⚠️ Customer ${event.customer_id} not found, marking event as processed`);
          await markEventProcessed(supabase, event.id, 'Customer not found');
          continue;
        }

        // Check provider readiness
        const providerCheck = await checkProviderReadiness(supabase, automation);
        if (!providerCheck.canProcess) {
          console.log(`⚠️ Provider not ready for automation ${automation.name}: ${providerCheck.reason}`);
          await markEventProcessed(supabase, event.id, providerCheck.reason);
          continue;
        }

        // Check for existing active run
        const { data: existingRun } = await supabase
          .from('automation_runs')
          .select('id, current_step_index, next_step_scheduled_at, run_sequence')
          .eq('automation_id', automation.id)
          .eq('customer_id', customer.id)
          .in('status', ['active', 'paused'])
          .maybeSingle();

        // Also check for recently completed runs (within 24h) to prevent re-triggering
        if (!existingRun) {
          const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
          const { data: recentlyCompleted } = await supabase
            .from('automation_runs')
            .select('id')
            .eq('automation_id', automation.id)
            .eq('customer_id', customer.id)
            .eq('status', 'completed')
            .gte('completed_at', oneDayAgo)
            .limit(1)
            .maybeSingle();

          if (recentlyCompleted) {
            console.log(`⏭️ Customer ${customer.email} - automation already completed within 24h (cooldown)`);
            await markEventProcessed(supabase, event.id, 'Automation completed within 24h cooldown');
            continue;
          }
        }

        // Always compute a safe next run sequence number (even if no active run)
        const { data: maxSeqData } = await supabase
          .from('automation_runs')
          .select('run_sequence')
          .eq('automation_id', automation.id)
          .eq('customer_id', customer.id)
          .order('run_sequence', { ascending: false })
          .limit(1)
          .maybeSingle();

        // Handle overlapping automations based on overlap_behavior setting
        const overlapBehavior = automation.overlap_behavior || 'ignore';
        let nextRunSequence = (maxSeqData?.run_sequence || 0) + 1;

        if (existingRun) {
          switch (overlapBehavior) {
            case 'ignore':
              // Current behavior - skip new trigger
              console.log(`⏭️ Customer ${customer.email} already in active run (mode: ignore)`);
              await markEventProcessed(supabase, event.id, 'Customer already in active run (ignore mode)');
              continue;

            case 'restart':
              // Cancel existing run and proceed with new one
              console.log(`🔄 Restarting automation for ${customer.email} (cancelling existing run)`);
              await supabase
                .from('automation_runs')
                .update({
                  status: 'cancelled',
                  error_message: 'Cancelled due to re-trigger (restart mode)',
                  completed_at: new Date().toISOString()
                })
                .eq('id', existingRun.id);
              // Also cancel any pending outbox messages for this run
              await supabase
                .from('crm_outbox')
                .update({
                  status: 'skipped',
                  skip_reason: 'Run restarted',
                  skipped_at: new Date().toISOString()
                })
                .eq('automation_run_id', existingRun.id)
                .eq('status', 'queued');
              break;

            case 'parallel':
              console.log(`🔀 Parallel run for ${customer.email} (sequence: ${nextRunSequence})`);
              break;

            case 'queue':
              // Queue the trigger to fire after current run completes
              console.log(`📋 Queueing trigger for ${customer.email} (existing run in progress)`);
              // Set queued_until to the next scheduled step time + buffer
              const queuedUntil = existingRun.next_step_scheduled_at
                ? new Date(new Date(existingRun.next_step_scheduled_at).getTime() + 5 * 60 * 1000).toISOString()
                : new Date(Date.now() + 60 * 60 * 1000).toISOString(); // Default 1 hour if no scheduled time
              await supabase
                .from('automation_trigger_events')
                .update({
                  queued_until: queuedUntil,
                  error_message: null
                })
                .eq('id', event.id);
              // Skip processing now - will be picked up later when queued_until passes
              continue;

            default:
              // Unknown mode - default to ignore
              console.log(`⏭️ Customer ${customer.email} already in active run (unknown mode: ${overlapBehavior})`);
              await markEventProcessed(supabase, event.id, 'Customer already in active run');
              continue;
          }
        }

        // Process the automation for this customer (handles both array and React Flow formats)
        const workflowSteps: WorkflowStep[] = normalizeWorkflowSteps(automation.workflow_steps);
        if (workflowSteps.length === 0) {
          console.log(`⚠️ No workflow steps for automation ${automation.id}`);
          await markEventProcessed(supabase, event.id, 'No workflow steps defined');
          continue;
        }

        // Create automation run with the determined sequence number
        const runId = await createAutomationRun(supabase, automation, customer, workflowSteps.length, undefined, nextRunSequence);
        if (!runId) {
          await markEventProcessed(supabase, event.id, 'Failed to create automation run');
          continue;
        }

        // Schedule the first step
        const firstStep = workflowSteps[0];
        const scheduledAt = calculateScheduledTime(firstStep.delayMin, automation, customer);

        await enqueueMessage(supabase, automation, customer, firstStep, 0, runId, scheduledAt);

        // Update run with next scheduled time
        await supabase
          .from('automation_runs')
          .update({ next_step_scheduled_at: scheduledAt.toISOString() })
          .eq('id', runId);

        // Mark event as processed
        await markEventProcessed(supabase, event.id);

        eventsProcessed++;
        eventsEnqueued++;

        console.log(`✅ Processed trigger event for customer ${customer.email} in automation ${automation.name}`);

      } catch (eventError) {
        console.error(`❌ Error processing trigger event ${event.id}:`, eventError);
        await markEventProcessed(supabase, event.id, eventError instanceof Error ? eventError.message : 'Unknown error');
      }
    }

  } catch (error) {
    console.error('❌ Error in processPendingTriggerEvents:', error);
  }

  return { eventsProcessed, eventsEnqueued };
}

async function markEventProcessed(supabase: any, eventId: string, errorMessage?: string) {
  const updateData: any = { processed_at: new Date().toISOString() };
  if (errorMessage) {
    updateData.error_message = errorMessage;
  }

  await supabase
    .from('automation_trigger_events')
    .update(updateData)
    .eq('id', eventId);
}

serve(handler);
