-- PostgreSQL grants EXECUTE on new functions to PUBLIC by default. For a
-- SECURITY DEFINER function in an API-exposed schema, that silently makes the
-- routine callable by anon and authenticated unless each migration remembers
-- to revoke it. Remove that inherited access globally and explicitly preserve
-- service-worker access. Tenant-checked application RPCs remain available to
-- authenticated users through their existing explicit grants.

DO $$
DECLARE
  v_function RECORD;
BEGIN
  FOR v_function IN
    SELECT
      namespace.nspname AS schema_name,
      procedure.proname AS function_name,
      pg_get_function_identity_arguments(procedure.oid) AS arguments
    FROM pg_proc AS procedure
    JOIN pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'public'
      AND procedure.prosecdef
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC, anon',
      v_function.schema_name,
      v_function.function_name,
      v_function.arguments
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION %I.%I(%s) TO service_role',
      v_function.schema_name,
      v_function.function_name,
      v_function.arguments
    );
  END LOOP;
END;
$$;

-- Regrant the tenant-checked and master-admin-checked RPC surface used by the
-- signed-in application. Some older functions relied only on PUBLIC's default
-- grant, so this explicit allowlist prevents the global cleanup from becoming
-- an accidental product outage.
DO $$
DECLARE
  v_function RECORD;
  v_authenticated_names CONSTANT TEXT[] := ARRAY[
    'admin_apply_email_governance_profile',
    'admin_change_tenant_plan',
    'admin_delete_user',
    'admin_extend_trial',
    'admin_get_email_governance_config',
    'admin_get_stats',
    'admin_get_tenant_campaign_creation_lock',
    'admin_get_tenant_email_governance_overrides',
    'admin_get_tenant_email_management_panel',
    'admin_get_tenant_suppression_controls',
    'admin_get_tenant_under_review_override',
    'admin_list_email_governance_internal_audit_log',
    'admin_list_global_email_suppressions',
    'admin_list_tenant_campaigns',
    'admin_list_tenant_email_domains',
    'admin_list_tenant_suppressions',
    'admin_list_tenants',
    'admin_set_email_governance_config',
    'admin_set_tenant_email_governance_overrides',
    'admin_toggle_tenant_active',
    'admin_unpause_tenant_email_domain',
    'begin_customer_csv_import',
    'calculate_tenant_perks_enrollment_rate',
    'check_email_exists',
    'check_send_quota',
    'claim_campaign_for_send',
    'clean_list_and_recover',
    'clear_campaign_schedule',
    'clear_user_recent_searches',
    'copy_master_templates_to_campaigns',
    'create_current_user_tenant',
    'delete_form_submissions',
    'delete_user_recent_search',
    'ensure_jobs_for_queued_email_messages',
    'find_images_by_tags',
    'generate_ticket_number',
    'get_activity_event',
    'get_activity_feed',
    'get_admin_user_data',
    'get_campaign_delivery_status_tenant_safe',
    'get_campaign_email_message_counts',
    'get_campaign_governance_visibility_tenant_safe',
    'get_campaign_recipient_detail',
    'get_campaign_recipients_page',
    'get_crm_dashboard_snapshot',
    'get_current_crm_access',
    'get_customer_activity_heatmap',
    'get_customer_catalog_stats',
    'get_customer_channel_trend',
    'get_customer_engagement_decay',
    'get_customer_engagement_timeline',
    'get_customer_export_page',
    'get_customer_purchase_timeline',
    'get_customer_unified_timeline',
    'get_domain_email_stats_30d',
    'get_duplicate_merge_suggestions',
    'get_email_campaign_progress',
    'get_email_campaign_reporting_snapshot',
    'get_email_consent_stats',
    'get_form_analytics',
    'get_form_submissions_page',
    'get_forms_with_stats',
    'get_my_overdue_campaigns',
    'get_next_message_sequence',
    'get_resource_insights',
    'get_sms_dashboard_stats',
    'get_tenant_content_intent_stats',
    'get_tenant_customer_summary',
    'get_tenant_email_health_dashboard',
    'get_tenant_lifecycle_stats',
    'get_tenant_reputation_policy',
    'get_tenant_risk_stats',
    'get_tenant_suppression_bypass_state',
    'get_tenant_under_review_override_state',
    'get_token_balance',
    'get_usage_stats',
    'get_user_image_analytics',
    'get_user_recent_items',
    'get_user_recent_searches',
    'has_role',
    'has_support_role',
    'has_tenant_permission',
    'import_crm_customer_batch',
    'increment_image_usage',
    'increment_template_usage',
    'is_master_admin',
    'is_super_admin',
    'mark_email_campaign_completed_with_failures',
    'merge_duplicate_accounts',
    'pause_email_campaign_sending',
    'recalculate_content_intent_metrics',
    'recalculate_lifecycle_metrics',
    'recalculate_loyalty_metrics',
    'recalculate_post_purchase_metrics',
    'recalculate_purchase_metrics',
    'recalculate_risk_signals',
    'recompute_campaign_metrics',
    'record_contact_import_event',
    'record_sms_link_click',
    'refresh_all_content_intent_metrics',
    'refresh_all_cross_channel_metrics',
    'refresh_all_lifecycle_metrics',
    'refresh_all_loyalty_metrics',
    'refresh_all_post_purchase_metrics',
    'refresh_all_purchase_metrics',
    'refresh_all_risk_signals',
    'reset_master_admin_account',
    'resume_email_campaign_sending',
    'retry_campaign_recipient_message',
    'retry_failed_email_messages',
    'save_tenant_location',
    'set_campaign_schedule',
    'set_customer_marketing_consent',
    'set_tenant_default_from_email_domain',
    'set_tenant_user_crm_access',
    'spend_tokens',
    'track_global_image_usage',
    'track_image_optimization',
    'upsert_user_recent_item',
    'upsert_user_recent_search'
  ]::TEXT[];
BEGIN
  FOR v_function IN
    SELECT
      namespace.nspname AS schema_name,
      procedure.proname AS function_name,
      pg_get_function_identity_arguments(procedure.oid) AS arguments
    FROM pg_proc AS procedure
    JOIN pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'public'
      AND procedure.prosecdef
      AND procedure.proname = ANY(v_authenticated_names)
  LOOP
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated',
      v_function.schema_name,
      v_function.function_name,
      v_function.arguments
    );
  END LOOP;
END;
$$;

-- These routines are worker internals, maintenance operations, billing and
-- rate-limit primitives, or trigger functions. None is a browser API. Use a
-- name-based loop so every overload is covered and future signature repairs do
-- not accidentally reopen an older overload.
DO $$
DECLARE
  v_function RECORD;
  v_internal_names CONSTANT TEXT[] := ARRAY[
    'acquire_provider_send_slot',
    'advance_automation_step',
    'apply_email_send_results',
    'apply_sms_delivery_status_batch',
    'bill_sms_message',
    'bulk_sms_opt_in',
    'check_sms_send_eligibility',
    'claim_domain_crisis_notifications',
    'claim_due_automation_trigger_events',
    'claim_due_sms_campaign_for_enqueue',
    'claim_email_send_job_ids',
    'claim_email_send_jobs',
    'claim_next_pos_sync_job',
    'claim_outbox_messages',
    'claim_scheduled_campaigns',
    'claim_segment_recompute_job',
    'claim_sms_campaign_enqueue',
    'claim_sms_send_jobs',
    'claim_tenant_hard_stop_notifications',
    'cleanup_expired_email_governance_overrides',
    'cleanup_expired_oauth_states',
    'cleanup_old_oauth_codes',
    'cleanup_stale_sync_jobs',
    'complete_automation_trigger_event',
    'complete_campaign_send',
    'complete_pos_sync_job',
    'expire_stale_automation_work',
    'fail_automation_trigger_event',
    'finish_segment_recompute_batch',
    'maybe_enforce_tenant_abuse_under_review',
    'recompute_recent_campaign_rollups',
    'record_automation_usage',
    'record_email_sends',
    'record_email_usage',
    'record_sms_sends',
    'record_sync_usage',
    'recover_stuck_pos_sync_jobs',
    'refresh_email_governance_tenant_reputation_score',
    'reserve_sms_send_tokens',
    'sync_subscription_to_org_budget',
    'system_pause_email_campaign_sending',
    'track_negative_behavior_event',
    'unsuppress_incorrectly_flagged_customers',
    'update_cross_channel_metrics',
    'update_customer_email_metrics',
    'update_customer_sms_metrics',
    'update_domain_warmup',
    'update_import_job_progress',
    'update_pos_sync_progress',
    'upsert_rate_limit',
    'verify_campaign_claim'
  ]::TEXT[];
BEGIN
  FOR v_function IN
    SELECT
      namespace.nspname AS schema_name,
      procedure.proname AS function_name,
      pg_get_function_identity_arguments(procedure.oid) AS arguments
    FROM pg_proc AS procedure
    JOIN pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'public'
      AND procedure.prosecdef
      AND (
        procedure.prorettype = 'trigger'::regtype
        OR procedure.proname = ANY(v_internal_names)
      )
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM authenticated',
      v_function.schema_name,
      v_function.function_name,
      v_function.arguments
    );
  END LOOP;
END;
$$;
