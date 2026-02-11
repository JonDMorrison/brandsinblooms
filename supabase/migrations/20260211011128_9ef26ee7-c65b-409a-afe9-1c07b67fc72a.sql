
-- Step 1: Add is_system_segment column
ALTER TABLE crm_segments
  ADD COLUMN is_system_segment BOOLEAN NOT NULL DEFAULT false;

-- Step 2: Mark existing system segments
UPDATE crm_segments
SET is_system_segment = true
WHERE name IN (
  'Perks Program',
  'Perks Members',
  'Loyalty Members',
  'High-Value Customers',
  'New Customers',
  'Lapsed Customers',
  'Seasonal Shoppers',
  'Frequent Buyers'
);

-- Step 3: Database trigger to prevent name/delete changes on system segments
CREATE OR REPLACE FUNCTION prevent_system_segment_modification()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_system_segment = true THEN
      RAISE EXCEPTION 'System segments cannot be deleted';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.is_system_segment = true THEN
      IF NEW.name IS DISTINCT FROM OLD.name THEN
        RAISE EXCEPTION 'System segment names cannot be changed';
      END IF;
      IF NEW.is_system_segment IS DISTINCT FROM OLD.is_system_segment THEN
        RAISE EXCEPTION 'System segment flag cannot be changed';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER guard_system_segments
  BEFORE UPDATE OR DELETE ON crm_segments
  FOR EACH ROW
  EXECUTE FUNCTION prevent_system_segment_modification();
