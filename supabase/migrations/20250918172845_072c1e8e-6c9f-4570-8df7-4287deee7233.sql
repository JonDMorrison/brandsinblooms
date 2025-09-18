-- First, manually remove duplicate predefined personas (keeping the oldest one)
DELETE FROM customer_personas
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY customer_id, predefined_persona_id
             ORDER BY created_at ASC
           ) as rn
    FROM customer_personas
    WHERE predefined_persona_id IS NOT NULL
  ) ranked
  WHERE rn > 1
);

-- Remove duplicate custom personas (keeping the oldest one)
DELETE FROM customer_personas
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY customer_id, persona_id
             ORDER BY created_at ASC
           ) as rn
    FROM customer_personas
    WHERE persona_id IS NOT NULL
  ) ranked
  WHERE rn > 1
);

-- Add partial unique constraints to prevent duplicates
-- For predefined personas
CREATE UNIQUE INDEX unique_customer_predefined_persona 
ON customer_personas (customer_id, predefined_persona_id) 
WHERE predefined_persona_id IS NOT NULL;

-- For custom personas  
CREATE UNIQUE INDEX unique_customer_custom_persona 
ON customer_personas (customer_id, persona_id) 
WHERE persona_id IS NOT NULL;