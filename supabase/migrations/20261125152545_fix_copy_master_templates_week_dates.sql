-- Applied to udldmkqwnxhdeztyqcau on 2026-11-25 (recorded version in filename).
-- Fix public.copy_master_templates_to_campaigns so the rows it writes satisfy
-- campaigns_week_date_consistency (week_number = EXTRACT(WEEK FROM start_date),
-- i.e. the ISO week of start_date).
--
-- Root cause: the previous body set start_date = CURRENT_DATE + (week_number - 1)
-- * 7 days, so template week 1 was dated "today" (ISO week 48 on 2026-11-25),
-- week 2 a week later, and so on. Almost every row violated the check, so the
-- first INSERT aborted the whole call. It also ignored target_user_id and wrote
-- rows with no user_id/tenant_id, which no RLS policy lets anyone read.
--
-- New behaviour:
--   * start_date is the Monday of ISO week <week_number> of the next occurrence
--     of that week (this ISO year if the week has not passed yet, otherwise the
--     next ISO year), giving a rolling 52-week calendar that starts at the
--     current week and always satisfies the constraint.
--   * Rows are owned by target_user_id (default: the caller) and scoped to that
--     user's public.users.tenant_id (NULL keeps the existing user-scoped
--     fallback that the campaigns SELECT policy already supports).
--   * Copying for someone other than the caller requires the service role /
--     a database role (no auth.uid()) or a master admin.
--   * source = 'master_templates' (already rendered by the campaign UI) and
--     re-running skips weeks already copied for the same scope and date.
-- Signature, return type, SECURITY DEFINER, search_path = '' and grants are
-- unchanged (CREATE OR REPLACE keeps owner and grants).

CREATE OR REPLACE FUNCTION public.copy_master_templates_to_campaigns(target_user_id uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  template_record RECORD;
  inserted_count INTEGER := 0;
  v_caller uuid := auth.uid();
  v_user_id uuid;
  v_tenant_id uuid;
  v_current_iso_year integer := EXTRACT(ISOYEAR FROM CURRENT_DATE)::integer;
  v_current_iso_week integer := EXTRACT(WEEK FROM CURRENT_DATE)::integer;
  v_target_iso_year integer;
  v_start_date date;
BEGIN
  v_user_id := COALESCE(target_user_id, v_caller);

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'copy_master_templates_to_campaigns requires a target user'
      USING ERRCODE = '22023';
  END IF;

  IF v_caller IS NOT NULL
     AND v_user_id <> v_caller
     AND NOT public.is_master_admin(v_caller) THEN
    RAISE EXCEPTION 'Not allowed to copy master templates for another user'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = v_user_id) THEN
    RAISE EXCEPTION 'Target user % does not exist', v_user_id
      USING ERRCODE = '23503';
  END IF;

  SELECT u.tenant_id
  INTO v_tenant_id
  FROM public.users u
  WHERE u.id = v_user_id;

  FOR template_record IN
    SELECT *
    FROM public.master_campaign_templates
    WHERE week_number BETWEEN 1 AND 52
    ORDER BY week_number
  LOOP
    v_target_iso_year := CASE
      WHEN template_record.week_number < v_current_iso_week
        THEN v_current_iso_year + 1
      ELSE v_current_iso_year
    END;

    -- Monday of ISO week <week_number> in ISO year v_target_iso_year. Weeks
    -- 1..52 exist in every ISO year, so EXTRACT(WEEK FROM v_start_date) always
    -- equals week_number and campaigns_week_date_consistency holds.
    v_start_date := pg_catalog.to_date(
      v_target_iso_year::text || pg_catalog.lpad(template_record.week_number::text, 2, '0'),
      'IYYYIW'
    );

    IF EXISTS (
      SELECT 1
      FROM public.campaigns c
      WHERE c.source = 'master_templates'
        AND c.deleted_at IS NULL
        AND c.start_date = v_start_date
        AND c.week_number = template_record.week_number
        AND (
          (v_tenant_id IS NOT NULL AND c.tenant_id = v_tenant_id)
          OR (v_tenant_id IS NULL AND c.tenant_id IS NULL AND c.user_id = v_user_id)
        )
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.campaigns (
      week_number,
      title,
      theme,
      prompt,
      description,
      start_date,
      user_id,
      tenant_id,
      created_by_user_id,
      source
    ) VALUES (
      template_record.week_number,
      template_record.title,
      template_record.theme,
      template_record.prompt,
      template_record.content_ideas,
      v_start_date,
      v_user_id,
      v_tenant_id,
      COALESCE(v_caller, v_user_id),
      'master_templates'
    );

    inserted_count := inserted_count + 1;
  END LOOP;

  RETURN inserted_count;
END;
$function$;
