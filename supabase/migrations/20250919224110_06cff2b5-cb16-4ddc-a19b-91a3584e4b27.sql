-- Enable all features for all users by default
UPDATE public.company_profiles 
SET feature_flags = jsonb_set(
    jsonb_set(
        jsonb_set(
            jsonb_set(
                jsonb_set(
                    jsonb_set(
                        jsonb_set(
                            COALESCE(feature_flags, '{}'::jsonb),
                            '{crm_enabled}', 'true'::jsonb
                        ),
                        '{analytics_v1}', 'true'::jsonb
                    ),
                    '{scheduling_v1}', 'true'::jsonb
                ),
                '{social_posting_v1}', 'true'::jsonb
            ),
            '{auto_send_campaigns}', 'true'::jsonb
        ),
        '{smart_timing_enabled}', 'true'::jsonb
    ),
    '{sms_setup_completed}', 'true'::jsonb
),
updated_at = now()
WHERE feature_flags IS NOT NULL OR feature_flags IS NULL;

-- Update default feature flags for new users by modifying the user creation trigger
CREATE OR REPLACE FUNCTION public.handle_new_user_team()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- Create team
  INSERT INTO public.teams (owner_id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'business_name', 'My Team'));
  
  -- Create company profile with all features enabled
  INSERT INTO public.company_profiles (
    user_id, 
    feature_flags
  ) VALUES (
    NEW.id,
    '{
      "crm_enabled": true,
      "analytics_v1": true,
      "scheduling_v1": true,
      "social_posting_v1": true,
      "auto_send_campaigns": true,
      "smart_timing_enabled": true,
      "sms_setup_completed": true,
      "sms_compliance_configured": true,
      "analytics_dashboard_v1": true
    }'::jsonb
  ) ON CONFLICT (user_id) DO UPDATE SET
    feature_flags = EXCLUDED.feature_flags,
    updated_at = now();
  
  RETURN NEW;
END;
$function$;