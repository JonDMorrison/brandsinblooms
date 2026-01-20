-- Fix immediate data: sync tenant name to match company profile
UPDATE public.tenants 
SET name = 'Brands in Blooms', updated_at = now()
WHERE id = '0a626809-3f46-45d8-b325-55de9c4ba576';