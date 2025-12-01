-- Create Plant Addicts tenant if it doesn't exist
INSERT INTO tenants (name, slug, is_active, settings)
VALUES ('Plant Addicts', 'plant-addicts', true, '{}')
ON CONFLICT (slug) DO NOTHING
RETURNING id;

-- Get the tenant ID (we'll use this in next steps)
DO $$
DECLARE
  v_tenant_id uuid;
  v_user_id uuid := '4d993313-c925-4c96-a8ee-3ab5be5c54cf';
BEGIN
  -- Get or create tenant
  SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'plant-addicts';
  
  -- Assign user to tenant
  UPDATE users 
  SET tenant_id = v_tenant_id 
  WHERE id = v_user_id;
  
  -- Create personas if they don't exist
  INSERT INTO crm_personas (tenant_id, user_id, persona_name, persona_description, is_custom)
  VALUES 
    (v_tenant_id, v_user_id, 'Shade Perennials', 'Customers who prefer shade-loving perennial plants', true),
    (v_tenant_id, v_user_id, 'Veggie Starts', 'Vegetable garden enthusiasts', true),
    (v_tenant_id, v_user_id, 'Houseplant Collector', 'Indoor plant enthusiasts', true),
    (v_tenant_id, v_user_id, 'Landscaper Pro', 'Professional landscapers and contractors', true),
    (v_tenant_id, v_user_id, 'Native Plants', 'Eco-conscious customers interested in native species', true),
    (v_tenant_id, v_user_id, 'Rose Gardener', 'Rose and flowering shrub enthusiasts', true),
    (v_tenant_id, v_user_id, 'Succulent Lover', 'Drought-tolerant plant collectors', true),
    (v_tenant_id, v_user_id, 'Beginner Gardener', 'New to gardening, need guidance', true)
  ON CONFLICT (tenant_id, persona_name) DO NOTHING;
END $$;