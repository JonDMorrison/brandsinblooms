-- Update stale customer_count values in crm_segments to match actual counts in customer_segments
UPDATE crm_segments s
SET customer_count = COALESCE(
  (SELECT COUNT(*) FROM customer_segments cs WHERE cs.segment_id = s.id),
  0
);

-- Create a function to automatically update segment customer_count when customer_segments changes
CREATE OR REPLACE FUNCTION update_segment_customer_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the count for the affected segment
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE crm_segments
    SET customer_count = (SELECT COUNT(*) FROM customer_segments WHERE segment_id = NEW.segment_id)
    WHERE id = NEW.segment_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE crm_segments
    SET customer_count = (SELECT COUNT(*) FROM customer_segments WHERE segment_id = OLD.segment_id)
    WHERE id = OLD.segment_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create triggers to keep customer_count in sync
DROP TRIGGER IF EXISTS trigger_update_segment_count_insert ON customer_segments;
CREATE TRIGGER trigger_update_segment_count_insert
  AFTER INSERT ON customer_segments
  FOR EACH ROW
  EXECUTE FUNCTION update_segment_customer_count();

DROP TRIGGER IF EXISTS trigger_update_segment_count_delete ON customer_segments;
CREATE TRIGGER trigger_update_segment_count_delete
  AFTER DELETE ON customer_segments
  FOR EACH ROW
  EXECUTE FUNCTION update_segment_customer_count();