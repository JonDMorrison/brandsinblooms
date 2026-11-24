-- Applied to udldmkqwnxhdeztyqcau on 2026-11-24 (recorded version in filename).
-- RPC lockdown part B (2 of 2): functions flagged function_search_path_mutable
-- whose bodies referenced public relations without a schema. Each is recreated
-- from its live pg_get_functiondef with those relations written as
-- public.<table> and SET search_path TO '' added. Signature, return type,
-- language, volatility and SECURITY DEFINER/INVOKER are unchanged, and
-- CREATE OR REPLACE keeps the existing owner, grants and extension membership.

-- admin_extend_trial(uuid,integer)
CREATE OR REPLACE FUNCTION public.admin_extend_trial(p_tenant_id uuid, p_days integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE 
  me text;
BEGIN
  SELECT current_setting('request.jwt.claims', true)::json ->> 'email' INTO me;
  IF NOT EXISTS (SELECT 1 FROM public.app_admin_emails WHERE email = me) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Extend the trial for all users in the tenant
  UPDATE public.subscriptions
  SET 
    end_date = end_date + (p_days || ' days')::interval,
    updated_at = now()
  WHERE user_id IN (
    SELECT id FROM public.users WHERE tenant_id = p_tenant_id
  )
  AND plan = 'free_trial';
END;
$function$;

-- admin_toggle_tenant_active(uuid,boolean)
CREATE OR REPLACE FUNCTION public.admin_toggle_tenant_active(p_tenant_id uuid, p_active boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE 
  me text;
BEGIN
  SELECT current_setting('request.jwt.claims', true)::json ->> 'email' INTO me;
  IF NOT EXISTS (SELECT 1 FROM public.app_admin_emails WHERE email = me) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.tenants
  SET 
    archived_at = CASE WHEN p_active THEN NULL ELSE now() END,
    updated_at = now()
  WHERE id = p_tenant_id;
END;
$function$;

-- auto_generate_session_title()
CREATE OR REPLACE FUNCTION public.auto_generate_session_title()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  session_title TEXT;
BEGIN
  IF NEW.message_type = 'user_prompt' THEN
    SELECT title INTO session_title 
    FROM public.ai_assistant_sessions 
    WHERE id = NEW.session_id;
    
    -- Only set title if it's null (first prompt)
    IF session_title IS NULL THEN
      UPDATE public.ai_assistant_sessions
      SET title = LEFT(NEW.content, 50) || CASE WHEN LENGTH(NEW.content) > 50 THEN '...' ELSE '' END
      WHERE id = NEW.session_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- copy_master_templates_to_campaigns(uuid)
CREATE OR REPLACE FUNCTION public.copy_master_templates_to_campaigns(target_user_id uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  template_record RECORD;
  inserted_count INTEGER := 0;
BEGIN
  FOR template_record IN 
    SELECT * FROM public.master_campaign_templates ORDER BY week_number
  LOOP
    INSERT INTO public.campaigns (
      week_number,
      title,
      theme,
      prompt,
      description,
      start_date
    ) VALUES (
      template_record.week_number,
      template_record.title,
      template_record.theme,
      template_record.prompt,
      template_record.content_ideas,
      CURRENT_DATE + (template_record.week_number - 1) * INTERVAL '7 days'
    );
    
    inserted_count := inserted_count + 1;
  END LOOP;
  
  RETURN inserted_count;
END;
$function$;

-- create_automation_from_draft(uuid,text)
CREATE OR REPLACE FUNCTION public.create_automation_from_draft(draft_id uuid, template_key text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  automation_record RECORD;
  new_automation_id UUID;
  template_timeline JSONB;
BEGIN
  -- Get the draft automation
  SELECT * INTO automation_record
  FROM public.crm_automations
  WHERE id = draft_id
  AND EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.tenant_id = crm_automations.tenant_id 
    AND u.id = auth.uid()
  );
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Draft automation not found or access denied';
  END IF;
  
  -- Generate new automation ID
  new_automation_id := gen_random_uuid();
  
  -- Set default timeline from template if provided
  IF template_key IS NOT NULL THEN
    -- In a real implementation, you'd fetch from campaignTemplates
    -- For now, set a simple default timeline
    template_timeline := jsonb_build_array(
      jsonb_build_object(
        'type', 'sms',
        'delayMin', 5,
        'text', 'Welcome to our loyalty program!'
      )
    );
  ELSE
    template_timeline := automation_record.workflow_steps;
  END IF;
  
  -- Create the new automation
  INSERT INTO public.crm_automations (
    id,
    tenant_id,
    user_id,
    name,
    trigger_type,
    trigger_conditions,
    workflow_steps,
    is_active,
    template_source
  ) VALUES (
    new_automation_id,
    automation_record.tenant_id,
    automation_record.user_id,
    automation_record.name,
    automation_record.trigger_type,
    automation_record.trigger_conditions,
    template_timeline,
    true, -- Activate the automation
    template_key
  );
  
  -- Delete the draft
  DELETE FROM public.crm_automations WHERE id = draft_id;
  
  RETURN new_automation_id;
END;
$function$;

-- delete_customers_except(text,uuid)
CREATE OR REPLACE FUNCTION public.delete_customers_except(p_keep_email text, p_tenant_id uuid)
 RETURNS TABLE(deleted_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user_tenant_id UUID;
  v_deleted_count INTEGER;
BEGIN
  -- Verify the calling user belongs to the tenant
  SELECT tenant_id INTO v_user_tenant_id
  FROM public.users
  WHERE id = auth.uid();
  
  IF v_user_tenant_id IS NULL OR v_user_tenant_id != p_tenant_id THEN
    RAISE EXCEPTION 'User does not have access to this tenant';
  END IF;
  
  -- Delete all customers except the one to keep
  WITH deleted AS (
    DELETE FROM public.crm_customers
    WHERE tenant_id = p_tenant_id
    AND email != p_keep_email
    RETURNING id
  )
  SELECT COUNT(*)::INTEGER INTO v_deleted_count FROM deleted;
  
  RETURN QUERY SELECT v_deleted_count;
END;
$function$;

-- generate_campaign_slug(text,uuid)
CREATE OR REPLACE FUNCTION public.generate_campaign_slug(campaign_title text, campaign_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
BEGIN
  -- Generate base slug from title
  base_slug := LOWER(REGEXP_REPLACE(TRIM(campaign_title), '[^a-zA-Z0-9]+', '-', 'g'));
  base_slug := REGEXP_REPLACE(base_slug, '^-+|-+$', '', 'g');
  
  -- Ensure minimum length
  IF LENGTH(base_slug) < 3 THEN
    base_slug := base_slug || '-' || SUBSTRING(campaign_id::TEXT FROM 1 FOR 8);
  END IF;
  
  final_slug := base_slug;
  
  -- Check for uniqueness and add counter if needed
  WHILE EXISTS (SELECT 1 FROM public.campaigns WHERE slug = final_slug AND id != campaign_id) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
  
  RETURN final_slug;
END;
$function$;

-- generate_ticket_number(uuid)
CREATE OR REPLACE FUNCTION public.generate_ticket_number(p_tenant_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  next_number INTEGER;
  ticket_number TEXT;
BEGIN
  PERFORM public.assert_tenant_access(p_tenant_id);
  SELECT COALESCE(MAX(CAST(SUBSTRING(support_tickets.ticket_number FROM 'TKT-(.*)') AS INTEGER)), 0) + 1
  INTO next_number
  FROM public.support_tickets
  WHERE support_tickets.tenant_id = p_tenant_id;
  
  ticket_number := 'TKT-' || LPAD(next_number::text, 6, '0');
  RETURN ticket_number;
END;
$function$;

-- has_support_role(uuid,uuid,support_role)
CREATE OR REPLACE FUNCTION public.has_support_role(_user_id uuid, _tenant_id uuid, _role public.support_role)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_support_roles
    WHERE user_id = _user_id
    AND tenant_id = _tenant_id
    AND role = _role
  );
END;
$function$;

-- is_super_admin(uuid)
CREATE OR REPLACE FUNCTION public.is_super_admin(user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.app_admin_emails
    WHERE email = (SELECT email FROM auth.users WHERE id = user_id)
  );
END;
$function$;

-- log_ticket_changes()
CREATE OR REPLACE FUNCTION public.log_ticket_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.support_ticket_history (ticket_id, user_id, action, old_value, new_value, description)
    VALUES (
      NEW.id,
      COALESCE(auth.uid(), NEW.user_id),
      'status_changed',
      jsonb_build_object('status', OLD.status),
      jsonb_build_object('status', NEW.status),
      'Status changed from ' || OLD.status || ' to ' || NEW.status
    );
  END IF;
  
  IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
    INSERT INTO public.support_ticket_history (ticket_id, user_id, action, old_value, new_value, description)
    VALUES (
      NEW.id,
      COALESCE(auth.uid(), NEW.user_id),
      'assigned',
      jsonb_build_object('assigned_to', OLD.assigned_to),
      jsonb_build_object('assigned_to', NEW.assigned_to),
      CASE 
        WHEN NEW.assigned_to IS NULL THEN 'Ticket unassigned'
        ELSE 'Ticket assigned to agent'
      END
    );
  END IF;
  
  IF OLD.priority IS DISTINCT FROM NEW.priority THEN
    INSERT INTO public.support_ticket_history (ticket_id, user_id, action, old_value, new_value, description)
    VALUES (
      NEW.id,
      COALESCE(auth.uid(), NEW.user_id),
      'priority_changed',
      jsonb_build_object('priority', OLD.priority),
      jsonb_build_object('priority', NEW.priority),
      'Priority changed from ' || OLD.priority || ' to ' || NEW.priority
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- recompute_customer_rollups(uuid,text)
CREATE OR REPLACE FUNCTION public.recompute_customer_rollups(p_tenant_id uuid, p_pos_source text DEFAULT 'vmx'::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE updated_count integer;
BEGIN
  PERFORM public.assert_tenant_access(p_tenant_id);
  UPDATE public.crm_customers c
  SET total_spent = s.total_spent,
      last_visit_date = s.last_visit,
      updated_at = now()
  FROM (
    SELECT external_customer_id,
           SUM(COALESCE(subtotal,0) + COALESCE(tax,0)) AS total_spent,
           MAX(post_date) AS last_visit
    FROM public.pos_receipts
    WHERE tenant_id = p_tenant_id
      AND external_customer_id IS NOT NULL
    GROUP BY external_customer_id
  ) s
  WHERE c.tenant_id = p_tenant_id
    AND c.pos_source = p_pos_source
    AND c.external_id = s.external_customer_id;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END; $function$;

-- sync_email_domain_to_company_profile()
CREATE OR REPLACE FUNCTION public.sync_email_domain_to_company_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  profile_user_id UUID;
BEGIN
  -- Only act when status changes to 'active'
  IF NEW.status = 'active' AND (OLD.status IS NULL OR OLD.status != 'active') THEN
    -- Get the user_id for this tenant (primary user)
    SELECT u.id INTO profile_user_id
    FROM public.users u
    WHERE u.tenant_id = NEW.tenant_id
    ORDER BY u.created_at ASC
    LIMIT 1;
    
    IF profile_user_id IS NOT NULL THEN
      UPDATE public.company_profiles
      SET 
        email_auth_status = 'verified',
        email_domain = NEW.domain,
        custom_sender_email = 'mail@' || NEW.domain,
        dns_records_verified = true,
        email_auth_setup_at = NOW(),
        updated_at = NOW()
      WHERE user_id = profile_user_id;
      
      RAISE NOTICE 'Synced email_domain % to company_profile for user %', NEW.domain, profile_user_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- update_session_image_count()
CREATE OR REPLACE FUNCTION public.update_session_image_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  UPDATE public.ai_assistant_sessions
  SET 
    image_count = image_count + 1,
    updated_at = now()
  WHERE id = NEW.session_id;
  
  RETURN NEW;
END;
$function$;

-- update_session_on_message_insert()
CREATE OR REPLACE FUNCTION public.update_session_on_message_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  UPDATE public.ai_assistant_sessions
  SET 
    message_count = message_count + 1,
    last_activity_at = now(),
    updated_at = now()
  WHERE id = NEW.session_id;
  
  RETURN NEW;
END;
$function$;

