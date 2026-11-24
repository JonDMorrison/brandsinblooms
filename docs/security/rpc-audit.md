# SECURITY DEFINER RPC audit (schema `public`)

Generated 2026-11-24 against production project `udldmkqwnxhdeztyqcau` (before migration `20261124140925_admin_rpc_lockdown`, verdicts reflect that migration).

Method: every `public` function with `prosecdef` where `has_function_privilege('anon'|'authenticated', oid, 'EXECUTE')` is true (this includes grants via PUBLIC). Totals: 479 SECURITY DEFINER functions in `public`; 240 executable by `authenticated`, 1 by `anon`, 0 via a PUBLIC grant.

"Caller check found" is a pattern scan of the function body for `is_master_admin`, `app_admin_emails`, tenant helpers (`has_tenant_permission`, `bloom_can_access_tenant`, `get_current_crm_access`, `users.tenant_id` lookups), `auth.uid()` and `auth.role()`/`service_role`. Every tenant_id-taking function and every function with no match was then read by hand; rows marked "Likely OK" use `auth.uid()` but were not individually re-verified.

Verdict key: FIXED = changed in this PR; OK = caller check present; STOPPED = tenant/caller gap left alone on purpose (reason given); OPEN = gap not addressed in part A.

| Function | Args | anon | auth | Caller check found | Verdict |
|---|---|---|---|---|---|
| `admin_add_global_email_suppression` | p_email text, p_reason text, p_expires_at timestamp with time zone | no | yes | is_master_admin, auth.uid() | OK: admin check |
| `admin_add_tenant_suppression` | p_tenant_id uuid, p_email text, p_suppression_type text, p_reason text, p_expires_at timestamp with time zone | no | yes | is_master_admin, auth.uid() | OK: admin check |
| `admin_apply_email_governance_profile` | p_profile text, p_reason text | no | yes | is_master_admin, auth.uid() | OK: admin check |
| `admin_backfill_subscription_budgets` | p_month date | no | yes | none | FIXED: master-admin guard (this PR) |
| `admin_bulk_lift_global_email_suppressions` | p_ids uuid[], p_reason text | no | yes | is_master_admin, auth.uid() | OK: admin check |
| `admin_bulk_lift_tenant_suppressions` | p_tenant_id uuid, p_suppression_ids uuid[], p_reason text | no | yes | is_master_admin, auth.uid() | OK: admin check |
| `admin_change_tenant_plan` | p_tenant_id uuid, p_plan text, p_end_date date, p_reason text | no | yes | app_admin_emails, auth.uid() | OK: admin check |
| `admin_clear_tenant_reputation_override` | p_tenant_id uuid, p_reason text | no | yes | is_master_admin, auth.uid() | OK: admin check |
| `admin_clear_tenant_suppression_history` | p_tenant_id uuid, p_reason text | no | yes | is_master_admin, auth.uid() | OK: admin check |
| `admin_clear_tenant_suppression_list` | p_tenant_id uuid, p_reason text | no | yes | is_master_admin, auth.uid() | OK: admin check |
| `admin_clear_tenant_temporary_boost` | p_tenant_id uuid, p_reason text | no | yes | is_master_admin, auth.uid() | OK: admin check |
| `admin_delete_user` | target_user_id uuid | no | yes | auth.uid() | FIXED: master-admin guard (part A); A2 also allows service_role / non-API sessions for the delete-account and delete-user-hard edge functions, which authenticate the requester themselves |
| `admin_disable_tenant_reputation_penalties` | p_tenant_id uuid, p_until timestamp with time zone, p_reason text | no | yes | is_master_admin, auth.uid() | OK: admin check |
| `admin_enable_tenant_reputation_penalties` | p_tenant_id uuid, p_reason text | no | yes | is_master_admin, auth.uid() | OK: admin check |
| `admin_extend_trial` | p_tenant_id uuid, p_days integer | no | yes | app_admin_emails, auth.role()/service_role | OK: admin check |
| `admin_extend_trial_by_email` | p_email text, p_days integer | no | yes | app_admin_emails, auth.role()/service_role | OK: admin check |
| `admin_force_stop_campaign` | p_campaign_id uuid, p_reason text | no | yes | is_master_admin, auth.uid() | OK: admin check |
| `admin_forgive_tenant_bounce_history` | p_tenant_id uuid, p_reason text | no | yes | is_master_admin, auth.uid() | OK: admin check |
| `admin_forgive_tenant_complaint_history` | p_tenant_id uuid, p_reason text | no | yes | is_master_admin, auth.uid() | OK: admin check |
| `admin_freeze_tenant_reputation_score` | p_tenant_id uuid, p_is_frozen boolean, p_reason text | no | yes | is_master_admin, auth.uid() | OK: admin check |
| `admin_get_email_governance_config` |  | no | yes | is_master_admin, auth.uid() | OK: admin check |
| `admin_get_stats` |  | no | yes | app_admin_emails, auth.uid() | OK: admin check |
| `admin_get_tenant_campaign_creation_lock` | p_tenant_id uuid | no | yes | is_master_admin, auth.uid() | OK: admin check |
| `admin_get_tenant_email_governance_overrides` | p_tenant_id uuid | no | yes | is_master_admin, auth.uid() | OK: admin check |
| `admin_get_tenant_email_management_panel` | p_tenant_id uuid, p_as_of timestamp with time zone | no | yes | is_master_admin, auth.uid() | OK: admin check |
| `admin_get_tenant_suppression_controls` | p_tenant_id uuid | no | yes | is_master_admin, auth.uid() | OK: admin check |
| `admin_get_tenant_under_review_override` | p_tenant_id uuid | no | yes | is_master_admin, auth.uid() | OK: admin check |
| `admin_lift_global_email_suppression` | p_id uuid, p_reason text | no | yes | is_master_admin, auth.uid() | OK: admin check |
| `admin_lift_tenant_suppression` | p_tenant_id uuid, p_suppression_id uuid, p_reason text | no | yes | is_master_admin, auth.uid() | OK: admin check |
| `admin_list_global_email_suppressions` | p_search text, p_reason_filter text, p_page integer, p_page_size integer | no | yes | is_master_admin, auth.uid() | OK: admin check |
| `admin_list_tenant_campaigns` | p_tenant_id uuid, p_search text, p_status_filter text, p_page integer, p_page_size integer | no | yes | is_master_admin, auth.uid() | OK: admin check |
| `admin_list_tenant_email_domains` | p_tenant_id uuid | no | yes | is_master_admin, auth.uid() | OK: admin check |
| `admin_list_tenant_suppressions` | p_tenant_id uuid, p_search text, p_reason_filter text, p_page integer, p_page_size integer | no | yes | is_master_admin, auth.uid() | OK: admin check |
| `admin_list_tenants` | p_search text, p_status text, p_limit integer, p_offset integer | no | yes | app_admin_emails, auth.uid() | OK: admin check |
| `admin_pause_campaign` | p_campaign_id uuid, p_reason text | no | yes | is_master_admin, auth.uid() | OK: admin check |
| `admin_pause_tenant_email_campaigns` | p_tenant_id uuid, p_reason text | no | yes | is_master_admin, auth.uid() | OK: admin check |
| `admin_reset_campaign_restrictions` | p_campaign_id uuid, p_reason text | no | yes | is_master_admin, auth.uid() | OK: admin check |
| `admin_reset_sync_usage_for_month` | p_tenant_id uuid, p_month date, p_reset_value integer | no | yes | none | FIXED: master-admin guard (this PR) |
| `admin_resume_campaign` | p_campaign_id uuid, p_reason text | no | yes | is_master_admin, auth.uid() | OK: admin check |
| `admin_resume_tenant_email_campaigns` | p_tenant_id uuid, p_reason text | no | yes | is_master_admin, auth.uid() | OK: admin check |
| `admin_resync_tenant_budget` | p_tenant_id uuid, p_month date, p_plan text | no | yes | none | FIXED: master-admin guard (this PR) |
| `admin_set_campaign_autopause_override` | p_campaign_id uuid, p_enabled boolean, p_precedence text, p_reason text, p_until timestamp with time zone | no | yes | is_master_admin, auth.uid() | OK: admin check |
| `admin_set_campaign_intervention_state` | p_campaign_id uuid, p_admin_paused boolean, p_force_stopped boolean, p_autopause_override_enabled boolean, ... | no | yes | is_master_admin, auth.uid() | OK: admin check |
| `admin_set_email_governance_config` | p_config jsonb, p_reason text | no | yes | is_master_admin, auth.uid() | OK: admin check |
| `admin_set_tenant_campaign_creation_lock` | p_tenant_id uuid, p_locked boolean, p_reason text | no | yes | is_master_admin, auth.uid() | OK: admin check |
| `admin_set_tenant_email_governance_overrides` | p_overrides_in jsonb, p_reason_in text, p_tenant_id_in uuid | no | yes | none | OK: (jsonb,text,uuid) overload delegates to the master-admin-checked overload |
| `admin_set_tenant_email_governance_overrides` | p_tenant_id uuid, p_overrides jsonb, p_reason text | no | yes | is_master_admin, auth.uid() | OK: (jsonb,text,uuid) overload delegates to the master-admin-checked overload |
| `admin_set_tenant_emergency_restriction` | p_tenant_id uuid, p_enabled boolean, p_until timestamp with time zone, p_reason text | no | yes | is_master_admin, auth.uid() | OK: admin check |
| `admin_set_tenant_reputation_override` | p_tenant_id uuid, p_score integer, p_mode text, p_expires_at timestamp with time zone, p_reason text | no | yes | is_master_admin, auth.uid() | OK: admin check |
| `admin_set_tenant_sending_limits` | p_tenant_id uuid, p_monthly integer, p_daily integer, p_hourly integer, p_reason text | no | yes | is_master_admin, auth.uid() | OK: admin check |
| `admin_set_tenant_suppression_bypass` | p_tenant_id uuid, p_enabled boolean, p_until timestamp with time zone, p_reason text, p_automation_mode text | no | yes | is_master_admin, auth.uid() | OK: admin check |
| `admin_set_tenant_temporary_boost` | p_tenant_id uuid, p_monthly integer, p_daily integer, p_hourly integer, p_until timestamp with time zone, p... | no | yes | is_master_admin, auth.uid() | OK: admin check |
| `admin_set_tenant_under_review_override` | p_tenant_id uuid, p_enabled boolean, p_precedence text, p_until timestamp with time zone, p_reason text | no | yes | is_master_admin, auth.uid() | OK: admin check |
| `admin_set_tenant_unlimited_sending` | p_tenant_id uuid, p_enabled boolean, p_reason text | no | yes | is_master_admin, auth.uid() | OK: admin check |
| `admin_toggle_tenant_active` | p_tenant_id uuid, p_active boolean | no | yes | app_admin_emails, auth.role()/service_role | OK: admin check |
| `admin_unpause_tenant_email_domain` | p_tenant_id uuid, p_domain_id uuid, p_reason text | no | yes | is_master_admin, auth.uid() | OK: admin check |
| `begin_customer_csv_import` | p_attestation_type text, p_contact_count integer, p_import_batch_id text, p_attestation_wording text | no | yes | auth.uid() | Likely OK: scoped via auth.uid() (not individually verified) |
| `bloom_can_access_tenant` | p_tenant_id uuid | no | yes | is_master_admin, auth.uid() | OK: admin check |
| `bloom_can_access_tenant_folder` | p_folder text | no | yes | none | OK: delegates to bloom_can_access_tenant |
| `bloomsuite_pos_marketing_workspace` |  | no | yes | none | OPEN: no caller check detected (not tenant_id-taking; out of part-A scope) |
| `bloomsuite_pos_purchase_health` | p_expected_tenant uuid | no | yes | none | OK: tenant derived from caller (preference_reviewer); argument must match |
| `calculate_churn_risk_score` | p_customer_id uuid | no | yes | none | OPEN: no caller check detected (not tenant_id-taking; out of part-A scope) |
| `calculate_content_intent_score` | p_customer_id uuid | no | yes | none | OPEN: no caller check detected (not tenant_id-taking; out of part-A scope) |
| `calculate_tenant_perks_enrollment_rate` | p_tenant_id uuid | no | yes | is_master_admin, auth.uid(), auth.role()/service_role | OK: admin check |
| `can_run_automation` | p_tenant_id uuid | no | yes | none | FIXED: assert_tenant_access guard (this PR) |
| `can_run_sync` | p_org_id uuid, p_provider pos_provider | no | yes | is_master_admin, auth.uid() | FIXED: assert_tenant_access guard (this PR) |
| `can_run_sync` | p_tenant_id uuid, p_estimated_rows integer | no | yes | none | FIXED: assert_tenant_access guard (this PR) |
| `can_send_emails` | p_tenant_id uuid, p_count integer | no | yes | none | STOPPED: email send-path quota, concurrent newsletter work; no caller found |
| `can_send_sms` | p_tenant_id uuid, p_count integer | no | yes | none | FIXED: assert_tenant_access guard (this PR) |
| `cancel_pos_sync_job` | p_job_id uuid | no | yes | none | OPEN: cancels any tenant's sync job by id |
| `check_email_exists` | email_to_check text | no | yes | none | OPEN: account enumeration against auth.users |
| `check_email_quota` | p_tenant_id uuid, p_recipient_count integer | no | yes | none | STOPPED: email send-path quota, concurrent newsletter work; no caller found |
| `check_send_quota` | p_tenant_id uuid, p_domain_id uuid, p_recipient_count integer | no | yes | auth.uid() | OK: raises unless caller's users.tenant_id matches (verified by hand) |
| `check_sms_quota` | p_tenant_id uuid, p_estimated_units integer | no | yes | none | FIXED: assert_tenant_access guard (this PR) |
| `claim_campaign_for_send` | campaign_id uuid | no | yes | none | OPEN: no caller check detected (not tenant_id-taking; out of part-A scope) |
| `claim_unowned_crm_campaign` | p_campaign_id uuid | no | yes | auth.uid() | Likely OK: scoped via auth.uid() (not individually verified) |
| `clean_list_and_recover` | target_tenant_id uuid | no | yes | auth.uid() | OK: raises unless caller has access to target tenant (verified by hand) |
| `clear_campaign_schedule` | p_campaign_id uuid | no | yes | tenant helper, auth.uid() | OK: tenant/role check |
| `compute_campaign_projected_recipient_count` | p_campaign_id uuid | no | yes | none | OPEN: no caller check detected (not tenant_id-taking; out of part-A scope) |
| `copy_master_templates_to_campaigns` | target_user_id uuid | no | yes | none | OPEN: inserts campaigns for any target_user_id |
| `create_automation_from_draft` | draft_id uuid, template_key text | no | yes | auth.uid() | Likely OK: scoped via auth.uid() (not individually verified) |
| `create_current_user_tenant` | p_name text | no | yes | auth.uid() | Likely OK: scoped via auth.uid() (not individually verified) |
| `crm_has_permission` | p_permission text, p_tenant_id uuid, p_location_id uuid | no | yes | none | OK: compares p_tenant_id with get_current_crm_access() of caller |
| `delete_customers_except` | p_keep_email text, p_tenant_id uuid | no | yes | tenant helper, auth.uid() | OK: raises unless caller belongs to tenant (verified by hand) |
| `delete_form_submissions` | p_tenant_id uuid, p_form_id uuid, p_submission_ids uuid[] | no | yes | auth.uid(), auth.role()/service_role | OK: service_role or caller tenant membership |
| `delete_nameless_customers` | p_tenant_id uuid, p_limit integer | no | yes | none | FIXED: assert_tenant_access guard (this PR) |
| `delete_phone_duplicates` | p_tenant_id uuid, p_limit integer | no | yes | none | FIXED: assert_tenant_access guard (this PR) |
| `determine_lifecycle_stage` | p_customer_id uuid | no | yes | none | OPEN: no caller check detected (not tenant_id-taking; out of part-A scope) |
| `email_gov_cfg_int` | p_path text[] | no | yes | none | OPEN: no caller check detected (not tenant_id-taking; out of part-A scope) |
| `email_gov_cfg_interval` | p_path text[] | no | yes | none | OPEN: no caller check detected (not tenant_id-taking; out of part-A scope) |
| `email_gov_cfg_num` | p_path text[] | no | yes | none | OPEN: no caller check detected (not tenant_id-taking; out of part-A scope) |
| `email_gov_cfg_value` | p_path text[] | no | yes | none | OPEN: no caller check detected (not tenant_id-taking; out of part-A scope) |
| `email_reachability_summary` | p_tenant_id uuid, p_customer_ids uuid[] | no | yes | tenant helper | STOPPED: owned by concurrent newsletter work (has a tenant check already) |
| `email_reputation_enforcement_enabled` |  | no | yes | none | OPEN: no caller check detected (not tenant_id-taking; out of part-A scope) |
| `enable_crm_for_user` | target_user_id uuid | no | yes | none | FIXED (A2): assert_user_access (self, master admin, service). No caller in repo; new profiles already get crm_enabled |
| `enqueue_pos_sync_job` | p_tenant_id uuid, p_provider pos_provider, p_sync_type pos_sync_type, p_estimated_rows integer, p_triggered... | no | yes | is_master_admin, auth.uid() | FIXED: assert_tenant_access guard (this PR) |
| `ensure_jobs_for_queued_email_messages` | p_campaign_id uuid, p_batch_size integer | no | yes | auth.uid() | Likely OK: scoped via auth.uid() (not individually verified) |
| `ensure_jobs_for_queued_email_messages` | p_campaign_id uuid, p_batch_size integer, p_jobs_per_minute integer, p_immediate_job_count integer, p_activ... | no | yes | auth.uid(), auth.role()/service_role | OK: tenant/role check |
| `ensure_org_usage_initialized` | p_tenant_id uuid | no | yes | none | STOPPED: internal helper nested in record_email_sends/record_sms_sends etc.; intended caller is SQL-internal. Recommend REVOKE from authenticated |
| `evaluate_campaign_batch_safety` | p_campaign_id uuid | no | yes | none | OPEN: no caller check detected (not tenant_id-taking; out of part-A scope) |
| `evaluate_tenant_hard_stop` | p_tenant_id uuid, p_as_of timestamp with time zone | no | yes | none | STOPPED: email-governance send path (concurrent work); no caller found |
| `fail_pos_sync_job` | p_job_id uuid, p_error text | no | yes | none | OPEN: fails/retries any sync job by id |
| `feature_enabled` | feature_name text | no | yes | auth.uid() | Likely OK: scoped via auth.uid() (not individually verified) |
| `find_images_by_tags` | p_tags text[], p_channel text, p_min_confidence numeric, p_limit integer | no | yes | none | OPEN: no caller check detected (not tenant_id-taking; out of part-A scope) |
| `fn_get_newsletter_ideas` | p_user_id uuid | no | yes | none | OPEN: reads data for any p_user_id |
| `generate_ticket_number` | p_tenant_id uuid | no | yes | none | FIXED: assert_tenant_access guard (this PR) |
| `get_active_sync_job_count` | p_tenant_id uuid | no | yes | none | FIXED: assert_tenant_access guard (this PR) |
| `get_activity_event` | p_event_id text | no | yes | auth.uid() | Likely OK: scoped via auth.uid() (not individually verified) |
| `get_activity_feed` | p_customer_id uuid, p_limit integer, p_offset integer, p_search text, p_status text[], p_actor_types text[]... | no | yes | auth.uid() | Likely OK: scoped via auth.uid() (not individually verified) |
| `get_activity_feed` | p_customer_id uuid, p_limit integer, p_offset integer, p_search text, p_status text[], p_actor_types text[]... | no | yes | auth.uid() | Likely OK: scoped via auth.uid() (not individually verified) |
| `get_admin_user_data` |  | no | yes | auth.uid() | Likely OK: scoped via auth.uid() (not individually verified) |
| `get_campaign_delivery_status` | p_campaign_id uuid | no | yes | auth.uid() | Likely OK: scoped via auth.uid() (not individually verified) |
| `get_campaign_derived_metrics` | p_campaign_id uuid | no | yes | none | OPEN: no caller check detected (not tenant_id-taking; out of part-A scope) |
| `get_campaign_intervention_state` | p_campaign_id uuid | no | yes | none | OPEN: no caller check detected (not tenant_id-taking; out of part-A scope) |
| `get_campaign_recipient_detail` | p_campaign_id uuid, p_recipient_id uuid, p_search text, p_event_filter text, p_sort_column text, p_sort_dir... | no | yes | auth.uid() | Likely OK: scoped via auth.uid() (not individually verified) |
| `get_campaign_recipient_matches` | p_campaign_id uuid, p_search text, p_event_filters text[], p_event_filter text, p_time_range text, p_delive... | no | yes | auth.uid() | Likely OK: scoped via auth.uid() (not individually verified) |
| `get_campaign_recipients_page` | p_campaign_id uuid, p_page integer, p_page_size integer, p_search text, p_event_filter text, p_sort_column ... | no | yes | auth.uid() | Likely OK: scoped via auth.uid() (not individually verified) |
| `get_campaign_reputation_policy` | p_campaign_id uuid | no | yes | none | OPEN: no caller check detected (not tenant_id-taking; out of part-A scope) |
| `get_crm_dashboard_snapshot` | p_tenant_id uuid, p_user_id uuid | no | yes | is_master_admin, auth.uid() | OK: admin check |
| `get_current_crm_access` |  | no | yes | is_master_admin, auth.uid() | OK: admin check |
| `get_customer_activity_heatmap` | p_customer_id uuid, p_channel text | no | yes | none | OPEN: no caller check detected (not tenant_id-taking; out of part-A scope) |
| `get_customer_catalog_stats` |  | no | yes | is_master_admin, auth.uid() | OK: admin check |
| `get_customer_channel_trend` | p_customer_id uuid, p_months integer | no | yes | none | OPEN: no caller check detected (not tenant_id-taking; out of part-A scope) |
| `get_customer_engagement_decay` | p_customer_id uuid | no | yes | none | OPEN: no caller check detected (not tenant_id-taking; out of part-A scope) |
| `get_customer_engagement_timeline` | p_customer_id uuid, p_months integer | no | yes | none | OPEN: no caller check detected (not tenant_id-taking; out of part-A scope) |
| `get_customer_export_page` | p_after_id uuid, p_limit integer | no | yes | auth.uid() | Likely OK: scoped via auth.uid() (not individually verified) |
| `get_customer_merge_review_queue` | p_limit integer, p_offset integer | no | yes | none | OK: scope from get_current_crm_access() |
| `get_customer_purchase_timeline` | p_customer_id uuid, p_months integer | no | yes | none | OPEN: no caller check detected (not tenant_id-taking; out of part-A scope) |
| `get_customer_unified_timeline` | p_customer_id uuid, p_limit integer, p_offset integer, p_event_types text[] | no | yes | none | OPEN: no caller check detected (not tenant_id-taking; out of part-A scope) |
| `get_deliverability_status` | p_domain_id uuid | no | yes | none | OPEN: no caller check detected (not tenant_id-taking; out of part-A scope) |
| `get_domain_email_stats_30d` | p_tenant_id uuid | no | yes | none | FIXED: assert_tenant_access guard (this PR) |
| `get_domain_remaining_limit` | p_domain_id uuid | no | yes | none | OPEN: no caller check detected (not tenant_id-taking; out of part-A scope) |
| `get_duplicate_merge_suggestions` |  | no | yes | auth.uid() | Likely OK: scoped via auth.uid() (not individually verified) |
| `get_email_campaign_progress` | p_campaign_id uuid | no | yes | auth.uid() | Likely OK: scoped via auth.uid() (not individually verified) |
| `get_email_campaign_reporting_snapshot` | p_campaign_id uuid | no | yes | tenant helper, auth.uid(), auth.role()/service_role | OK: tenant/role check |
| `get_email_consent_stats` | p_tenant_id uuid | no | yes | none | FIXED: assert_tenant_access guard (this PR) |
| `get_email_governance_config` |  | no | yes | none | OPEN: no caller check detected (not tenant_id-taking; out of part-A scope) |
| `get_form_analytics` | p_tenant_id uuid, p_form_id uuid, p_days integer | no | yes | is_master_admin, auth.uid(), auth.role()/service_role | OK: admin check |
| `get_form_placement_breakdown` | p_tenant_id uuid, p_form_id uuid, p_days integer | no | yes | is_master_admin, auth.uid(), auth.role()/service_role | OK: admin check |
| `get_form_submissions_page` | p_tenant_id uuid, p_form_id uuid, p_page integer, p_page_size integer, p_result_filter text, p_search text,... | no | yes | is_master_admin, auth.uid(), auth.role()/service_role | OK: admin check |
| `get_forms_with_stats` | p_tenant_id uuid, p_stats_days integer | no | yes | is_master_admin, auth.uid(), auth.role()/service_role | OK: admin check |
| `get_global_in_progress_count` |  | no | yes | none | OPEN: no caller check detected (not tenant_id-taking; out of part-A scope) |
| `get_jwt_tenant_id` |  | no | yes | auth.role()/service_role | OPEN: no caller check detected (not tenant_id-taking; out of part-A scope) |
| `get_marketing_analytics_overview` | p_days integer | no | yes | auth.uid() | Likely OK: scoped via auth.uid() (not individually verified) |
| `get_my_overdue_campaigns` |  | no | yes | tenant helper, auth.uid() | OK: tenant/role check |
| `get_next_message_sequence` | p_session_id uuid | no | yes | none | OPEN: no caller check detected (not tenant_id-taking; out of part-A scope) |
| `get_overdue_campaigns` | p_tenant_id uuid | no | yes | none | STOPPED: campaign function (concurrent work); no caller found |
| `get_recipient_email_delivery_timeline` | p_tenant_id uuid, p_email text, p_customer_id uuid, p_limit integer | no | no | none | FIXED (A2): EXECUTE revoked from authenticated/anon/PUBLIC, service_role only. No caller in repo |
| `get_remaining_budget` | p_tenant_id uuid | no | yes | none | FIXED: assert_tenant_access guard (this PR) |
| `get_resource_insights` | p_tenant_id uuid, p_resource_type text, p_resource_id uuid | no | yes | auth.uid() | OK: returns empty unless caller's users.tenant_id = p_tenant_id (verified by hand) |
| `get_sms_dashboard_stats` |  | no | yes | auth.uid() | Likely OK: scoped via auth.uid() (not individually verified) |
| `get_sms_warmup_info` | p_phone_number text, p_messaging_service_sid text | no | yes | none | OPEN: no caller check detected (not tenant_id-taking; out of part-A scope) |
| `get_sync_queue_status` |  | no | yes | none | OPEN: no caller check detected (not tenant_id-taking; out of part-A scope) |
| `get_tenant_access_overview` | p_tenant_id uuid | no | yes | tenant helper, auth.uid() | OK: cross-tenant check via get_current_crm_access() |
| `get_tenant_content_intent_stats` | p_tenant_id uuid | no | yes | none | FIXED: assert_tenant_access guard (this PR) |
| `get_tenant_email_health_dashboard` | p_tenant_id uuid, p_as_of timestamp with time zone | no | yes | auth.uid() | OK: returns nothing unless caller's tenant = p_tenant_id (verified by hand) |
| `get_tenant_lifecycle_stats` | p_tenant_id uuid | no | yes | none | FIXED: assert_tenant_access guard (this PR) |
| `get_tenant_reputation_policy` | p_tenant_id uuid | no | yes | none | STOPPED: send path; nested in get_campaign_reputation_policy and email health/admin panels; concurrent campaign work |
| `get_tenant_risk_stats` | p_tenant_id uuid | no | yes | none | FIXED: assert_tenant_access guard (this PR) |
| `get_tenant_suppression_bypass_state` | p_tenant_id uuid | no | yes | none | STOPPED: send path; called by 5 edge functions and nested in email_reachability_summary; concurrent work |
| `get_token_balance` | p_user_id uuid | no | yes | none | OPEN: any user's token balance (p_user_id) |
| `get_usage_stats` | p_user_id uuid | no | yes | none | OPEN: any user's subscription usage (p_user_id) |
| `get_user_image_analytics` |  | no | yes | auth.uid() | Likely OK: scoped via auth.uid() (not individually verified) |
| `has_role` | _user_id uuid, _role app_role | no | yes | none | OPEN: no caller check detected (not tenant_id-taking; out of part-A scope) |
| `has_support_role` | _user_id uuid, _tenant_id uuid, _role support_role | no | yes | none | STOPPED: boolean predicate about an arbitrary user; no caller found; intent unclear |
| `has_tenant_permission` | p_tenant_id uuid, p_permission text, p_location_id uuid | no | yes | is_master_admin, auth.uid(), auth.role()/service_role | OK: admin check |
| `import_crm_customer_batch` | p_customers jsonb, p_attestation_id uuid | no | yes | auth.uid() | Likely OK: scoped via auth.uid() (not individually verified) |
| `increment_image_usage` | asset_id uuid | no | yes | auth.uid() | Likely OK: scoped via auth.uid() (not individually verified) |
| `increment_template_usage` | template_id uuid | no | yes | auth.uid() | Likely OK: scoped via auth.uid() (not individually verified) |
| `internal_function_url` | p_slug text | yes | yes | none | Review: only anon-executable SECURITY DEFINER function; returns an internal edge-function URL |
| `is_master_admin` | _user_id uuid | no | yes | app_admin_emails | OK: admin check |
| `is_super_admin` | user_id uuid | no | yes | app_admin_emails | OK: admin check |
| `log_admin_action` | p_action_type text, p_target_tenant_id uuid, p_target_user_id uuid, p_action_details jsonb | no | yes | is_master_admin, auth.uid() | OK: admin check |
| `log_form_automation_execution` | p_tenant_id uuid, p_automation_id uuid, p_automation_run_id uuid, p_submission_id uuid, p_customer_id uuid,... | no | yes | none | STOPPED: log write, no caller in repo; intended caller unclear |
| `log_import_batch_error` | p_job_id uuid, p_batch_number integer, p_error_message text, p_failed_items jsonb | no | yes | none | OPEN: no caller check detected (not tenant_id-taking; out of part-A scope) |
| `mark_email_campaign_completed_with_failures` | p_campaign_id uuid | no | yes | none | OPEN: no caller check detected (not tenant_id-taking; out of part-A scope) |
| `mark_expired_incentives` |  | no | yes | none | OPEN: no caller check detected (not tenant_id-taking; out of part-A scope) |
| `mark_onboarding_completed` | p_company text | no | yes | auth.uid() | Likely OK: scoped via auth.uid() (not individually verified) |
| `match_bloom_knowledge_chunks` | p_tenant_id uuid, p_query_embedding vector, p_match_count integer, p_min_similarity double precision | no | yes | auth.role()/service_role | OK: service_role or bloom_can_access_tenant(p_tenant_id) |
| `merge_duplicate_accounts` | keep_user_id uuid, merge_user_id uuid | no | yes | auth.uid() | Likely OK: scoped via auth.uid() (not individually verified) |
| `native_reward_read_workspace` |  | no | yes | none | OK: scope from get_current_crm_access() |
| `pause_email_campaign_sending` | p_campaign_id uuid | no | yes | auth.uid() | Likely OK: scoped via auth.uid() (not individually verified) |
| `pos_membership_workspace` |  | no | yes | none | OK: scope from get_current_crm_access() |
| `publish_care_guide_design` | p_tenant_id uuid, p_expected_version integer, p_design jsonb | no | yes | tenant helper, auth.uid() | OK: tenant/role check |
| `recalculate_content_intent_metrics` | p_customer_id uuid | no | yes | none | OPEN: no caller check detected (not tenant_id-taking; out of part-A scope) |
| `recalculate_cross_channel_scores` | p_customer_id uuid | no | yes | none | OPEN: no caller check detected (not tenant_id-taking; out of part-A scope) |
| `recalculate_customer_engagement` | p_customer_id uuid | no | yes | none | OPEN: no caller check detected (not tenant_id-taking; out of part-A scope) |
| `recalculate_lifecycle_metrics` | p_customer_id uuid | no | yes | none | OPEN: no caller check detected (not tenant_id-taking; out of part-A scope) |
| `recalculate_loyalty_metrics` | p_customer_id uuid | no | yes | none | OPEN: no caller check detected (not tenant_id-taking; out of part-A scope) |
| `recalculate_post_purchase_metrics` | p_customer_id uuid | no | yes | none | OPEN: no caller check detected (not tenant_id-taking; out of part-A scope) |
| `recalculate_purchase_metrics` | p_customer_id uuid | no | yes | auth.role()/service_role | OPEN: no caller check detected (not tenant_id-taking; out of part-A scope) |
| `recalculate_risk_signals` | p_customer_id uuid | no | yes | none | OPEN: no caller check detected (not tenant_id-taking; out of part-A scope) |
| `recalculate_sms_engagement_score` | p_customer_id uuid | no | yes | none | OPEN: no caller check detected (not tenant_id-taking; out of part-A scope) |
| `recompute_campaign_metrics` | p_campaign_id uuid | no | yes | none | OPEN: no caller check detected (not tenant_id-taking; out of part-A scope) |
| `recompute_customer_rollups` | p_tenant_id uuid, p_pos_source text | no | yes | none | FIXED: assert_tenant_access guard (this PR) |
| `recompute_square_customer_locations` | p_tenant_id uuid, p_external_customer_ids text[] | no | yes | auth.role()/service_role | OK: get_current_crm_access() for authenticated, else service_role |
| `reconcile_campaign_email_rollups` | p_campaign_id uuid, p_tenant_id uuid | no | yes | none | STOPPED: campaign rollup (concurrent work); no caller found |
| `reconcile_customer_email_rollups` | p_tenant_id uuid, p_customer_id uuid | no | yes | none | STOPPED: email rollup (concurrent work); no caller found |
| `record_contact_import_event` | p_tenant_id uuid, p_source text, p_contact_count integer, p_metadata jsonb | no | yes | none | FIXED: assert_tenant_access guard (this PR) |
| `record_sms_link_click` | p_tracking_code text, p_user_agent text | no | yes | none | OPEN: no caller check detected (not tenant_id-taking; out of part-A scope) |
| `refill_tokens` | p_user_id uuid, p_tokens integer | no | no | none | FIXED (A2): master admin (API) or service only; EXECUTE revoked from authenticated. No caller in repo |
| `refresh_all_content_intent_metrics` | p_tenant_id uuid | no | yes | none | FIXED: assert_tenant_access guard (this PR) |
| `refresh_all_cross_channel_metrics` | p_tenant_id uuid | no | yes | none | FIXED: assert_tenant_access guard (this PR) |
| `refresh_all_lifecycle_metrics` | p_tenant_id uuid | no | yes | none | FIXED: assert_tenant_access guard (this PR) |
| `refresh_all_loyalty_metrics` | p_tenant_id uuid | no | yes | none | FIXED: assert_tenant_access guard (this PR) |
| `refresh_all_post_purchase_metrics` | p_tenant_id uuid | no | yes | none | FIXED: assert_tenant_access guard (this PR) |
| `refresh_all_purchase_metrics` | p_tenant_id uuid | no | yes | auth.role()/service_role | OK: get_current_crm_access() for authenticated, else service_role |
| `refresh_all_risk_signals` | p_tenant_id uuid | no | yes | none | FIXED: assert_tenant_access guard (this PR) |
| `replace_connected_email_draft` | p_tenant_id uuid, p_campaign_id uuid, p_expected_updated_at timestamp with time zone, p_blocks jsonb, p_con... | no | yes | tenant helper, auth.uid() | OK: tenant/role check |
| `replace_connected_sms_draft` | p_tenant_id uuid, p_campaign_id uuid, p_expected_updated_at timestamp with time zone, p_name text, p_messag... | no | yes | tenant helper, auth.uid() | OK: tenant/role check |
| `reset_master_admin_account` | target_user_id uuid | no | yes | auth.uid() | Likely OK: scoped via auth.uid() (not individually verified) |
| `resolve_customer_merge_review` | p_suggestion_id uuid, p_survivor_customer_id uuid, p_duplicate_customer_id uuid, p_action text, p_reason text | no | yes | auth.uid() | Likely OK: scoped via auth.uid() (not individually verified) |
| `resolve_effective_subscription_tier` | p_tenant_id uuid | no | yes | none | STOPPED: internal helper (sync_subscription_to_org_budget); recommend REVOKE from authenticated |
| `restore_user_data` | target_user_id uuid | no | no | none | FIXED (A2): master admin (API) or service only; EXECUTE revoked from authenticated. No caller in repo |
| `resume_email_campaign_sending` | p_campaign_id uuid | no | yes | auth.uid() | Likely OK: scoped via auth.uid() (not individually verified) |
| `retry_campaign_recipient_message` | p_campaign_id uuid, p_recipient_id uuid | no | yes | auth.uid() | Likely OK: scoped via auth.uid() (not individually verified) |
| `retry_failed_email_messages` | p_campaign_id uuid | no | yes | none | OPEN: no caller check detected (not tenant_id-taking; out of part-A scope) |
| `retry_failed_email_messages` | p_campaign_id uuid, p_batch_size integer | no | yes | auth.uid() | Likely OK: scoped via auth.uid() (not individually verified) |
| `review_bloomsuite_pos_marketing` | p_event uuid, p_approve boolean, p_reason text, p_withdrawals_reviewed boolean | no | yes | auth.uid() | Likely OK: scoped via auth.uid() (not individually verified) |
| `save_care_guide_design_draft` | p_tenant_id uuid, p_draft jsonb | no | yes | tenant helper, auth.uid() | OK: tenant/role check |
| `save_connected_sms_draft` | p_tenant_id uuid, p_campaign_id uuid, p_expected_updated_at timestamp with time zone, p_name text, p_messag... | no | yes | tenant helper, auth.uid() | OK: tenant/role check |
| `save_native_reward_read_mapping` | p_key text, p_programme_version uuid, p_activation uuid, p_expected_version integer, p_enabled boolean, p_r... | no | yes | auth.uid() | Likely OK: scoped via auth.uid() (not individually verified) |
| `save_pos_membership_policy` | p_key text, p_store uuid, p_programme_version uuid, p_expected_version integer, p_authority text, p_terms_v... | no | yes | auth.uid() | Likely OK: scoped via auth.uid() (not individually verified) |
| `save_tenant_location` | p_location_id uuid, p_name text, p_code text, p_timezone text, p_is_active boolean | no | yes | auth.uid() | Likely OK: scoped via auth.uid() (not individually verified) |
| `scan_current_tenant_customer_duplicates` | p_limit integer | no | yes | none | OK: scope from get_current_crm_access() |
| `set_campaign_schedule` | p_campaign_id uuid, p_scheduled_at timestamp with time zone, p_timezone text | no | yes | tenant helper, auth.uid() | OK: tenant/role check |
| `set_customer_marketing_consent_authorized` | p_customer_id uuid, p_channel text, p_opt_in boolean, p_source text, p_consent_basis text, p_evidence text,... | no | yes | auth.uid() | Likely OK: scoped via auth.uid() (not individually verified) |
| `set_tenant_default_from_email_domain` | p_domain_id uuid | no | yes | tenant helper, auth.uid() | OK: tenant/role check |
| `set_tenant_user_crm_access` | p_user_id uuid, p_role text, p_location_ids uuid[] | no | yes | auth.uid() | Likely OK: scoped via auth.uid() (not individually verified) |
| `set_weekly_theme_images` | p_campaign_id uuid, p_images jsonb | no | yes | auth.uid() | Likely OK: scoped via auth.uid() (not individually verified) |
| `soft_delete_user_data` | target_user_id uuid | no | yes | none | FIXED (A2): assert_user_access (self, master admin, service). No caller in repo |
| `spend_tokens` | p_user_id uuid, p_tokens integer, p_action_type text, p_content_type text, p_campaign_id uuid | no | yes | none | FIXED (A2): assert_user_access (self, master admin, service); negative amounts rejected for non-admin API callers. Callers: useTokens, ParallelContentGenerator (own user id) |
| `stage_ideal_journal_chunk` | p_tenant_id uuid, p_batch_id text, p_seq integer, p_payload text, p_sha256 text | no | yes | is_master_admin, auth.uid() | OK: admin check |
| `stop_email_campaign_sending` | p_campaign_id uuid, p_reason text | no | yes | auth.uid() | Likely OK: scoped via auth.uid() (not individually verified) |
| `track_content_interaction` | p_tenant_id uuid, p_customer_id uuid, p_session_id text, p_channel text, p_content_type text, p_interaction... | no | yes | none | STOPPED: tracking write, no caller in repo; unclear whether a public/anon pipeline is intended |
| `track_global_image_usage` | p_image_id uuid, p_tenant_id uuid, p_user_id uuid, p_context text, p_campaign_id uuid, p_block_id uuid | no | yes | none | FIXED: assert_tenant_access guard (this PR) |
| `track_image_optimization` | asset_id uuid, original_size_bytes bigint, compressed_size_bytes bigint | no | yes | auth.uid() | Likely OK: scoped via auth.uid() (not individually verified) |
| `track_incentive_redeemed` | p_customer_id uuid, p_code text, p_order_id uuid, p_order_total numeric, p_discount_applied numeric | no | yes | none | OPEN: no caller check detected (not tenant_id-taking; out of part-A scope) |
| `track_incentive_sent` | p_customer_id uuid, p_tenant_id uuid, p_code text, p_value numeric, p_value_type text, p_incentive_type tex... | no | yes | none | STOPPED: tracking write, no caller in repo; intended caller unclear |
| `validate_email_governance_config` | p_config jsonb | no | yes | none | OPEN: no caller check detected (not tenant_id-taking; out of part-A scope) |

## Security advisor counts (get_advisors type=security)

| Lint | Level | Before | After |
|---|---|---|---|
| rls_enabled_no_policy | INFO | 115 | 115 |
| function_search_path_mutable | WARN | 103 | 103 |
| extension_in_public | WARN | 3 | 3 |
| anon_security_definer_function_executable | WARN | 1 | 1 |
| authenticated_security_definer_function_executable | WARN | 240 | 240 |
| auth_otp_long_expiry | WARN | 1 | 1 |
| auth_leaked_password_protection | WARN | 1 | 1 |
| Total | | 464 | 464 |

The advisor lints on grants, not on function bodies, so adding in-body guards does not change its counts.
The `search_path = ''` pass on the 103 `function_search_path_mutable` functions is deferred to part B.

## Follow-ups not done in part A

- The OPEN HIGH rows (`refill_tokens`, `spend_tokens`, `soft_delete_user_data`, `restore_user_data`, `enable_crm_for_user`) take a user id with no caller check. Any signed-in user can call them for any other user.
- The STOPPED rows each give a reason. `get_recipient_email_delivery_timeline` is the most urgent of them because it exposes recipient PII across tenants.
- `admin_delete_user` is called by the `delete-account` and `delete-user-hard` edge functions with a service-role client, so `auth.uid()` is NULL there. Both the old email allowlist and the new master-admin check reject those calls. Those flows were already failing before this change and still fail after it.

## Part A2 (migration `20261124142456_user_rpc_lockdown`)

- New guard `public.assert_user_access(uuid)`: API callers (JWT role anon/authenticated) must be that user or a master admin; service_role and non-API sessions pass.
- The five OPEN HIGH user-id rows and `get_recipient_email_delivery_timeline` are now FIXED (see the table). `admin_delete_user` now also accepts service_role.
- Verified on production over REST with a throwaway user: another user's id gives 403 (42501) for `spend_tokens`, `soft_delete_user_data`, `enable_crm_for_user` and `admin_delete_user`. The user's own id gives 200 for the three self-service RPCs. `spend_tokens` with a negative amount gives 400. `refill_tokens` and `restore_user_data` give 403 (permission denied). `get_recipient_email_delivery_timeline` gives 403 when signed in and 401 as anon. `delete-account` with another user's id returns 400 `Unauthorized`.
- Still open: account deletion passes the guard but then fails on `users_created_by_user_id_fkey`. `public.users.created_by_user_id` references `auth.users` with NO ACTION, and every signup row references itself. `admin_delete_user` does not remove the `public.users` row, so the final `DELETE FROM auth.users` is rejected. `admin_delete_user` needs a follow-up change.
