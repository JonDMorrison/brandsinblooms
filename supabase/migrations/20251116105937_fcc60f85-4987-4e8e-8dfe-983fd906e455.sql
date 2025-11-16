-- Fix ambiguous column reference in generate_ticket_number function

CREATE OR REPLACE FUNCTION generate_ticket_number(p_tenant_id UUID)
RETURNS TEXT AS $$
DECLARE
  next_number INTEGER;
  ticket_number TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(support_tickets.ticket_number FROM 'TKT-(.*)') AS INTEGER)), 0) + 1
  INTO next_number
  FROM support_tickets
  WHERE support_tickets.tenant_id = p_tenant_id;
  
  ticket_number := 'TKT-' || LPAD(next_number::text, 6, '0');
  RETURN ticket_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;