-- Remove duplicate persona assignments, keeping only one of each persona per customer
DELETE FROM customer_personas
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY customer_id, 
                         COALESCE(persona_id, predefined_persona_id)
             ORDER BY created_at ASC
           ) as rn
    FROM customer_personas
  ) ranked
  WHERE rn > 1
);

-- Add unique constraint to prevent duplicate persona assignments
ALTER TABLE customer_personas 
ADD CONSTRAINT unique_customer_persona 
UNIQUE (customer_id, persona_id, predefined_persona_id);