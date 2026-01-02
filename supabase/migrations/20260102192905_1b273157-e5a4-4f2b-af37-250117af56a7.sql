-- Function to generate fallback sender for new tenants
CREATE OR REPLACE FUNCTION public.generate_tenant_fallback_sender()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug text;
  v_fallback_email text;
BEGIN
  -- Only generate if not already set
  IF NEW.fallback_sender_email IS NOT NULL THEN
    RETURN NEW;
  END IF;
  
  -- Generate slug from tenant name or use existing slug
  v_slug := COALESCE(
    NEW.slug,
    lower(regexp_replace(COALESCE(NEW.name, 'tenant'), '[^a-zA-Z0-9]+', '-', 'g'))
  );
  
  -- Remove leading/trailing hyphens
  v_slug := trim(both '-' from v_slug);
  
  -- Ensure slug is not empty
  IF v_slug = '' OR v_slug IS NULL THEN
    v_slug := 'tenant';
  END IF;
  
  -- Create unique fallback email: {slug}-{short-uuid}@mail.bloomsuite.app
  v_fallback_email := v_slug || '-' || substring(NEW.id::text, 1, 8) || '@mail.bloomsuite.app';
  
  -- Set fallback sender fields
  NEW.fallback_sender_email := v_fallback_email;
  NEW.fallback_from_name := COALESCE(NEW.name, 'BloomSuite User');
  NEW.fallback_sender_created_at := now();
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_generate_fallback_sender ON public.tenants;

-- Create trigger on tenant insert
CREATE TRIGGER trigger_generate_fallback_sender
  BEFORE INSERT ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_tenant_fallback_sender();

-- Backfill existing tenants without fallback sender
UPDATE public.tenants
SET 
  fallback_sender_email = 
    trim(both '-' from lower(regexp_replace(COALESCE(slug, COALESCE(name, 'tenant')), '[^a-zA-Z0-9]+', '-', 'g')))
    || '-' || substring(id::text, 1, 8) || '@mail.bloomsuite.app',
  fallback_from_name = COALESCE(name, 'BloomSuite User'),
  fallback_sender_created_at = now()
WHERE fallback_sender_email IS NULL;