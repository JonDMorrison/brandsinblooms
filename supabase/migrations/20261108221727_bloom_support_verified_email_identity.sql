-- Resolve existing verified client identities before choosing an unlinked email
-- principal. This does not create or upgrade any verified membership.
CREATE OR REPLACE FUNCTION bloom_support.resolve_email_sender(p_email text, p_name text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE pid uuid; acct uuid; e text := lower(btrim(p_email)); dom text;
  matched text := 'none'; membership_accounts integer;
BEGIN
  IF e IS NULL OR e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'invalid sender' USING ERRCODE = '22023'; END IF;
  dom := split_part(e, '@', 2);
  -- Consider all eligible identities, not only the oldest one. Multiple
  -- products may verify the same account; different accounts are ambiguous.
  SELECT count(DISTINCT m.account_id),
         CASE WHEN count(DISTINCT m.account_id) = 1 THEN (array_agg(m.account_id))[1] END
    INTO membership_accounts, acct
    FROM bloom_support.principals p
    JOIN bloom_support.account_members m ON m.principal_id = p.id AND m.verified
   WHERE lower(p.email) = e AND p.active AND p.role = 'client';

  SELECT p.id INTO pid FROM bloom_support.principals p
   WHERE lower(p.email) = e AND p.active AND p.role = 'client'
   ORDER BY EXISTS (SELECT 1 FROM bloom_support.account_members m
                     WHERE m.principal_id = p.id AND m.verified AND m.account_id = acct) DESC,
            (p.kind = 'user') DESC, p.created_at, p.id
   LIMIT 1;
  IF FOUND THEN matched := 'principal'; END IF;
  IF pid IS NULL THEN
    INSERT INTO bloom_support.principals(kind, product, external_id, email, display_name, role)
    VALUES ('external_user', 'email', e, e, p_name, 'client')
    ON CONFLICT (product, external_id) DO UPDATE SET updated_at = now()
      WHERE principals.active AND principals.role = 'client' AND lower(principals.email) = e
    RETURNING id INTO pid;
    -- A disabled, reassigned or staff email identity must not be resurrected
    -- through the upsert conflict path.
    IF pid IS NULL THEN RAISE EXCEPTION 'forbidden: sender identity unavailable' USING ERRCODE = '42501'; END IF;
  END IF;
  IF acct IS NOT NULL THEN matched := 'membership';
  ELSIF membership_accounts = 0 THEN
    -- An ambiguous verified identity must not fall through to domain matching.
    SELECT CASE WHEN count(*) = 1 THEN (array_agg(a.id))[1] END INTO acct FROM bloom_support.accounts a
     WHERE dom = ANY(a.email_domains) AND a.merged_into IS NULL
       AND dom NOT IN ('gmail.com','outlook.com','hotmail.com','yahoo.com','icloud.com','live.com','aol.com','shaw.ca','telus.net','rogers.com','sympatico.ca');
    IF acct IS NOT NULL THEN
      matched := 'domain';
      INSERT INTO bloom_support.account_members(account_id, principal_id, relationship, verified) VALUES (acct, pid, 'email_contact', false)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN jsonb_build_object('principal_id', pid, 'account_id', acct, 'match', matched);
END $$;
