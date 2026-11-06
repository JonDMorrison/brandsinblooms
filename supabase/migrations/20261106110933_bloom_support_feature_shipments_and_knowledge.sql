-- Durable feature-shipment promises and a small reviewed product knowledge set.
--
-- A feature request can outlive its original ticket. The subscription below is
-- deliberately separate from ticket workflow state: shipping a feature may
-- notify a requester, but it must never reopen a resolved ticket or take a
-- human-owned conversation back from Support.

-- ---------------------------------------------------------------------------
-- 1. Source-grounded, client-safe product knowledge.
-- ---------------------------------------------------------------------------
ALTER TABLE bloom_support.knowledge
  ADD COLUMN IF NOT EXISTS source_refs jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE bloom_support.knowledge
  DROP CONSTRAINT IF EXISTS knowledge_source_refs_check;
ALTER TABLE bloom_support.knowledge
  ADD CONSTRAINT knowledge_source_refs_check
  CHECK (jsonb_typeof(source_refs) = 'array' AND jsonb_array_length(source_refs) <= 20);

COMMENT ON COLUMN bloom_support.knowledge.source_refs IS
  'Private repository paths that substantiate an article. Never included in the public help or answer-search projections.';

INSERT INTO bloom_support.knowledge(id, product, title, body, audience, approved, source_refs)
VALUES
  (
    '6f76e09a-38d1-4db2-a231-c01e79ce1001', 'crm', 'Import customers from a CSV file',
    E'1. Open Customers, use the menu beside Add Customer, and choose Upload List.\n2. Download the CSV template if you need the expected columns, then choose your file.\n3. Review the column mapping before you continue.\n4. Choose the consent statement that truthfully describes the list, then confirm the import.\n\nIf you choose that you are unsure or do not have consent records, the contacts are imported but held from marketing email until consent is recorded. The completed screen shows imported, merged, skipped, and failed rows.',
    'client', true,
    '["src/pages/crm/CRMCustomersPage.tsx","src/components/crm/segments/EnhancedSegmentImportDialog.tsx","src/lib/crm/importConsent.ts"]'::jsonb
  ),
  (
    '6f76e09a-38d1-4db2-a231-c01e79ce1002', 'crm', 'Create and send an email campaign',
    E'1. Open Campaigns and choose New Campaign.\n2. Add the email subject and content, choose the audience, and confirm the sender details.\n3. Review the send checks. BloomSuite will block sending when required content, a valid sender, a saved draft, or an eligible audience is missing.\n4. Choose Send Now, or choose Schedule for later and confirm the date and time.\n\nResolve every item shown in the review before sending. A campaign needs at least one eligible recipient.',
    'client', true,
    '["src/pages/crm/CRMCampaignsPage.tsx","src/pages/crm/CRMCampaignEditorPage.tsx","src/components/crm/campaign-editor/CampaignScheduleDrawer.tsx"]'::jsonb
  ),
  (
    '6f76e09a-38d1-4db2-a231-c01e79ce1003', 'crm', 'Why a contact is not eligible for email',
    E'A contact appears in an email audience only when the record has a deliverable email address, marketing-email consent, and no active suppression.\n\nOpen the audience preview to check the eligible and suppressed totals. Then review the contact email and consent record. A contact who was imported with consent marked as unsure stays paused until consent is recorded. Do not change consent unless you have a valid record of it.',
    'client', true,
    '["src/components/crm/segments/rule-builder/SegmentLivePreview.tsx","src/pages/crm/CRMCampaignEditorPage.tsx","src/lib/crm/importConsent.ts"]'::jsonb
  ),
  (
    '6f76e09a-38d1-4db2-a231-c01e79ce2001', 'cms', 'Launch a page and update a live page',
    E'An unlaunched page is marked Draft and is not visible to visitors. Open it in the page editor, finish your changes, and choose Launch page when you are ready to make it public.\n\nFor a page that is already live, edit the page and choose Save. Those saved changes update the live page. Use View Live Page to check the public result. If an older saved draft is waiting, the editor shows Publish saved draft so you can push that draft live.',
    'client', true,
    '["../cms-brandsinblooms/src/components/editor-beta/UnifiedPageEditor.tsx","../cms-brandsinblooms/src/lib/editor/page-status.ts"]'::jsonb
  ),
  (
    '6f76e09a-38d1-4db2-a231-c01e79ce2002', 'cms', 'Upload or replace a page image',
    E'1. Open the page and select the section that contains the image.\n2. Choose an image file, or choose Choose from library. If an image is already present, use Replace.\n3. Check the preview and adjust the crop or framing when that control is available.\n4. Add useful alt text when the section provides an Alt text field.\n5. Save the page, then use View Live Page to check the result on a live page.\n\nIf an upload fails, use the inline retry. Refresh the editor if it says uploads are not ready.',
    'client', true,
    '["../cms-brandsinblooms/src/components/editor-media-upload/EditorMediaUpload.tsx","../cms-brandsinblooms/src/components/editor-media-upload/EditorImageField.tsx","../cms-brandsinblooms/src/components/content-editor/editors/ImageSectionEditor.tsx"]'::jsonb
  ),
  (
    '6f76e09a-38d1-4db2-a231-c01e79ce2003', 'cms', 'Review a product before it goes live',
    E'A product marked Needs review has been flagged for you to check before it goes live, usually because a price, image, or detail is missing.\n\nOpen the product, check the customer-facing name and description, confirm its price and image, and complete any other highlighted details. Preview the storefront result before making the product available. Do not guess a missing price or product detail; confirm it from your source records.',
    'client', true,
    '["../cms-brandsinblooms/src/lib/help/admin-help-content.ts"]'::jsonb
  ),
  (
    '6f76e09a-38d1-4db2-a231-c01e79ce3001', 'pos', 'Start a shift safely',
    E'1. Count the actual cash float and enter that amount.\n2. Check the store, register, and your cashier name.\n3. Open the till.\n4. Before serving customers, check sync and second-copy status.\n\nIf loading does not finish, keep the iPad powered on and ask your manager. Do not clear browser data or create a replacement sale to bypass loading.',
    'client', true,
    '["../bloomtill/apps/till/src/help/guides.ts#open-session","../bloomtill/apps/till/src/help/guides.ts#loading"]'::jsonb
  ),
  (
    '6f76e09a-38d1-4db2-a231-c01e79ce3002', 'pos', 'Find products and build a sale',
    E'1. Scan the tag, or search by common name, botanical name, or SKU. Use Find without barcode when a tag is missing or unreadable.\n2. Confirm the photo and exact pot size. Use the supported substitution or damage action when needed.\n3. Review quantities and prices, then choose Checkout.\n\nA protected price change may need manager approval.',
    'client', true,
    '["../bloomtill/apps/till/src/help/guides.ts#till"]'::jsonb
  ),
  (
    '6f76e09a-38d1-4db2-a231-c01e79ce3003', 'pos', 'Take a payment once and recover safely',
    E'1. Review the total and choose the customer''s tender.\n2. Follow each card or cash step.\n3. Wait for a confirmed receipt before treating the sale as paid.\n\nIf the outcome is uncertain, do not switch registers or start another charge. Use saved-payment recovery after an interruption. Return cash only when the recovery step tells you to do so.',
    'client', true,
    '["../bloomtill/apps/till/src/help/guides.ts#tender"]'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. One durable shipment subscription per linked ticket.
-- ---------------------------------------------------------------------------
CREATE TABLE bloom_support.feature_shipment_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_request_id uuid NOT NULL REFERENCES bloom_support.feature_requests(id) ON DELETE CASCADE,
  ticket_id uuid NOT NULL REFERENCES bloom_support.tickets(id) ON DELETE CASCADE,
  account_id uuid REFERENCES bloom_support.accounts(id) ON DELETE SET NULL,
  requester_id uuid REFERENCES bloom_support.principals(id) ON DELETE SET NULL,
  notification_message_id uuid UNIQUE REFERENCES bloom_support.messages(id) ON DELETE SET NULL,
  delivery_status text NOT NULL DEFAULT 'pending' CHECK (delivery_status IN (
    'pending','queued','sent','delivered','bounced','complained','failed','suppressed','uncertain'
  )),
  notification_queued_at timestamptz,
  notification_sent_at timestamptz,
  notification_delivered_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (feature_request_id, ticket_id),
  CHECK ((cancelled_at IS NULL) = (cancellation_reason IS NULL))
);
CREATE INDEX feature_shipment_subscriptions_feature
  ON bloom_support.feature_shipment_subscriptions(feature_request_id, delivery_status);
CREATE INDEX feature_shipment_subscriptions_requester
  ON bloom_support.feature_shipment_subscriptions(requester_id, created_at DESC)
  WHERE requester_id IS NOT NULL;

ALTER TABLE bloom_support.feature_shipment_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON bloom_support.feature_shipment_subscriptions FROM PUBLIC, anon, authenticated;

INSERT INTO bloom_support.feature_shipment_subscriptions(
  feature_request_id, ticket_id, account_id, requester_id,
  cancelled_at, cancellation_reason
)
SELECT e.feature_request_id, e.ticket_id, coalesce(e.account_id, t.account_id), t.requester_id,
       CASE WHEN t.spam OR t.redacted_at IS NOT NULL OR t.merged_into IS NOT NULL THEN now() END,
       CASE WHEN t.spam THEN 'ticket marked as spam'
            WHEN t.redacted_at IS NOT NULL THEN 'ticket was redacted'
            WHEN t.merged_into IS NOT NULL THEN 'ticket was merged'
       END
FROM bloom_support.feature_evidence e
JOIN bloom_support.tickets t ON t.id = e.ticket_id
ON CONFLICT (feature_request_id, ticket_id) DO NOTHING;

CREATE OR REPLACE FUNCTION bloom_support.enqueue_feature_shipment(p_subscription uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  s bloom_support.feature_shipment_subscriptions;
  t bloom_support.tickets;
  feature_status text;
  job_id uuid;
  ticket_missing boolean;
BEGIN
  SELECT * INTO s
  FROM bloom_support.feature_shipment_subscriptions
  WHERE id = p_subscription
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found: feature shipment subscription' USING ERRCODE = 'P0002';
  END IF;

  SELECT status INTO feature_status
  FROM bloom_support.feature_requests
  WHERE id = s.feature_request_id;
  IF feature_status IS DISTINCT FROM 'shipped' OR s.cancelled_at IS NOT NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO t FROM bloom_support.tickets WHERE id = s.ticket_id;
  ticket_missing := NOT FOUND;
  IF ticket_missing OR t.spam OR t.redacted_at IS NOT NULL OR t.merged_into IS NOT NULL THEN
    UPDATE bloom_support.feature_shipment_subscriptions
    SET cancelled_at = coalesce(cancelled_at, now()),
        cancellation_reason = coalesce(cancellation_reason,
          CASE WHEN ticket_missing THEN 'ticket no longer exists'
               WHEN t.spam THEN 'ticket marked as spam'
               WHEN t.redacted_at IS NOT NULL THEN 'ticket was redacted'
               ELSE 'ticket was merged' END),
        delivery_status = 'suppressed',
        updated_at = now()
    WHERE id = s.id;
    RETURN NULL;
  END IF;

  IF s.notification_message_id IS NOT NULL THEN
    SELECT id INTO job_id
    FROM bloom_support.jobs
    WHERE idempotency_key = 'feature-shipment-email:' || s.id::text;
    RETURN job_id;
  END IF;

  job_id := bloom_support.enqueue_job(
    'answer', t.id, NULL,
    'account:' || coalesce(t.account_id::text, 'none:' || t.id::text),
    jsonb_build_object(
      'mode', 'feature_shipment',
      'decision', 'shipped',
      'feature_request_id', s.feature_request_id,
      'subscription_id', s.id
    ),
    'feature-shipment:' || s.id::text
  );

  UPDATE bloom_support.feature_shipment_subscriptions
  SET notification_queued_at = coalesce(notification_queued_at, now()),
      delivery_status = CASE WHEN delivery_status = 'pending' THEN 'queued' ELSE delivery_status END,
      updated_at = now()
  WHERE id = s.id;
  RETURN job_id;
END
$$;

-- Routing creates the durable promise immediately. Linking a request to a
-- feature that has already shipped queues the same one-time notification,
-- without changing the ticket's workflow state.
CREATE OR REPLACE FUNCTION bloom_support.route_feature_request(p_actor uuid, p_ticket uuid, p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  t bloom_support.tickets;
  f uuid;
  feature_status text;
  subscription_id uuid;
BEGIN
  PERFORM bloom_support.require_permission(p_actor, 'tickets.write');
  t := bloom_support.require_ticket(p_actor, p_ticket);
  f := coalesce((p->>'feature_request_id')::uuid, t.feature_request_id);
  IF f IS NULL THEN
    INSERT INTO bloom_support.feature_requests(title, description, product)
    VALUES (coalesce(p->>'title', t.subject), coalesce(p->>'description', t.summary), t.product)
    RETURNING id INTO f;
    INSERT INTO bloom_support.escalations(ticket_id, feature_request_id, audience, reason, detail, dedupe_key)
    VALUES (t.id, f, 'jon', 'feature_decision', coalesce(p->>'title', t.subject), 'feature:' || f::text);
    PERFORM bloom_support.notify_staff(t.id, 'feature.awaiting_decision', 'Feature decision: ' || left(coalesce(p->>'title', t.subject), 80), 'jon');
  END IF;

  SELECT status INTO feature_status FROM bloom_support.feature_requests WHERE id = f;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found: feature request' USING ERRCODE = 'P0002'; END IF;

  INSERT INTO bloom_support.feature_evidence(feature_request_id, ticket_id, account_id, excerpt)
  VALUES (f, t.id, t.account_id, left(coalesce(p->>'excerpt', t.summary), 1000))
  ON CONFLICT DO NOTHING;

  INSERT INTO bloom_support.feature_shipment_subscriptions(feature_request_id, ticket_id, account_id, requester_id)
  VALUES (f, t.id, t.account_id, t.requester_id)
  ON CONFLICT (feature_request_id, ticket_id) DO UPDATE
    SET account_id = coalesce(EXCLUDED.account_id, bloom_support.feature_shipment_subscriptions.account_id),
        requester_id = coalesce(EXCLUDED.requester_id, bloom_support.feature_shipment_subscriptions.requester_id),
        updated_at = now()
  RETURNING id INTO subscription_id;

  IF feature_status = 'shipped' THEN
    UPDATE bloom_support.tickets
    SET feature_request_id = f,
        kind = 'feature',
        version = version + 1,
        updated_at = now()
    WHERE id = t.id;
    PERFORM bloom_support.enqueue_feature_shipment(subscription_id);
  ELSE
    UPDATE bloom_support.tickets
    SET feature_request_id = f,
        kind = 'feature',
        stage = 'awaiting_decision',
        status = 'needs_owner',
        next_action = 'Admin decides on the feature request',
        version = version + 1,
        updated_at = now()
    WHERE id = t.id;
  END IF;

  PERFORM bloom_support.log(t.id, t.account_id, p_actor, 'feature.routed',
    jsonb_build_object('feature_request_id', f, 'shipment_subscription_id', subscription_id));
  RETURN jsonb_build_object('feature_request_id', f, 'shipment_subscription_id', subscription_id);
END
$$;

-- Decision updates still reach active Bloom-owned conversations. Human-owned
-- and resolved tickets keep their exact workflow state. A shipped decision is
-- delivered through the subscription path for every still-valid requester.
CREATE OR REPLACE FUNCTION bloom_support.decide_feature_request(
  p_actor uuid,
  p_feature uuid,
  p_decision text,
  p_note text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  tk record;
  sub record;
  previous bloom_support.feature_requests;
  changed boolean;
BEGIN
  PERFORM bloom_support.require_permission(p_actor, 'features.decide');
  IF p_decision NOT IN ('accepted', 'declined', 'planned', 'shipped') THEN
    RAISE EXCEPTION 'invalid decision' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO previous
  FROM bloom_support.feature_requests
  WHERE id = p_feature
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found: feature request' USING ERRCODE = 'P0002'; END IF;
  changed := previous.status IS DISTINCT FROM p_decision;

  UPDATE bloom_support.feature_requests
  SET status = p_decision,
      decision_note = p_note,
      decided_by = p_actor,
      decided_at = now(),
      updated_at = now()
  WHERE id = p_feature;

  UPDATE bloom_support.escalations
  SET status = 'resolved',
      decision = p_decision || coalesce(': ' || p_note, ''),
      decided_by = p_actor,
      resolved_at = now()
  WHERE feature_request_id = p_feature AND status <> 'resolved';

  IF changed THEN
    -- A later decision supersedes any older decision that has not reached the
    -- provider. Prevent both the old answer job and an already-rendered old
    -- email from arriving after the current outcome.
    UPDATE bloom_support.messages m
    SET delivery = 'suppressed', withdrawn_at = coalesce(withdrawn_at, now())
    WHERE m.delivery IN ('queued','failed','uncertain')
      AND EXISTS (
        SELECT 1
        FROM bloom_support.jobs old_decision
        JOIN bloom_support.tickets linked ON linked.id = old_decision.ticket_id
        WHERE linked.feature_request_id = p_feature
          AND old_decision.kind = 'answer'
          AND old_decision.payload->>'mode' = 'feature_decision'
          AND old_decision.payload->>'decision' IS DISTINCT FROM p_decision
          AND m.idempotency_key = 'feature-decision:' || old_decision.id::text
      );

    UPDATE bloom_support.jobs email_job
    SET status = 'cancelled', last_error = 'superseded by a newer feature decision', updated_at = now()
    WHERE email_job.kind = 'send_email' AND email_job.status = 'queued'
      AND EXISTS (
        SELECT 1
        FROM bloom_support.messages m
        JOIN bloom_support.jobs old_decision
          ON m.idempotency_key = 'feature-decision:' || old_decision.id::text
        JOIN bloom_support.tickets linked ON linked.id = old_decision.ticket_id
        WHERE linked.feature_request_id = p_feature
          AND old_decision.kind = 'answer'
          AND old_decision.payload->>'mode' = 'feature_decision'
          AND old_decision.payload->>'decision' IS DISTINCT FROM p_decision
          AND m.id::text = email_job.payload->>'message_id'
      );

    UPDATE bloom_support.jobs old_decision
    SET status = 'cancelled', last_error = 'superseded by a newer feature decision', updated_at = now()
    WHERE old_decision.kind = 'answer' AND old_decision.status = 'queued'
      AND old_decision.payload->>'mode' = 'feature_decision'
      AND old_decision.payload->>'decision' IS DISTINCT FROM p_decision
      AND EXISTS (
        SELECT 1 FROM bloom_support.tickets linked
        WHERE linked.id = old_decision.ticket_id AND linked.feature_request_id = p_feature
      );
  END IF;

  IF NOT changed THEN
    FOR tk IN SELECT id, account_id FROM bloom_support.tickets WHERE feature_request_id = p_feature LOOP
      PERFORM bloom_support.log(tk.id, tk.account_id, p_actor, 'feature.decision_note_updated',
        jsonb_build_object('decision', p_decision, 'note', p_note));
    END LOOP;
  ELSIF p_decision = 'shipped' THEN
    -- Pick up evidence that predates this table as well as newly-routed tickets.
    INSERT INTO bloom_support.feature_shipment_subscriptions(feature_request_id, ticket_id, account_id, requester_id)
    SELECT e.feature_request_id, e.ticket_id, coalesce(e.account_id, t.account_id), t.requester_id
    FROM bloom_support.feature_evidence e
    JOIN bloom_support.tickets t ON t.id = e.ticket_id
    WHERE e.feature_request_id = p_feature
    ON CONFLICT (feature_request_id, ticket_id) DO NOTHING;

    FOR sub IN
      SELECT id FROM bloom_support.feature_shipment_subscriptions
      WHERE feature_request_id = p_feature AND cancelled_at IS NULL
    LOOP
      PERFORM bloom_support.enqueue_feature_shipment(sub.id);
    END LOOP;

    FOR tk IN SELECT id, account_id FROM bloom_support.tickets WHERE feature_request_id = p_feature LOOP
      PERFORM bloom_support.log(tk.id, tk.account_id, p_actor, 'feature.shipped',
        jsonb_build_object('decision', p_decision, 'note', p_note));
    END LOOP;
  ELSE
    FOR tk IN
      SELECT id, account_id, automation, executor, status, merged_into, spam, redacted_at
      FROM bloom_support.tickets
      WHERE feature_request_id = p_feature
    LOOP
      IF tk.status <> 'resolved' AND tk.merged_into IS NULL AND NOT tk.spam
         AND tk.redacted_at IS NULL AND tk.automation = 'auto' AND tk.executor = 'bloom' THEN
        UPDATE bloom_support.tickets
        SET stage = 'answering',
            status = 'working',
            waiting_reason = NULL,
            waiting_since = NULL,
            next_action = 'Tell the client the decision: ' || p_decision,
            version = version + 1,
            updated_at = now()
        WHERE id = tk.id;

        PERFORM bloom_support.enqueue_job(
          'answer', tk.id, NULL,
          'account:' || coalesce(tk.account_id::text, 'none:' || tk.id::text),
          jsonb_build_object('mode', 'feature_decision', 'decision', p_decision),
          'feature-decision:' || p_feature::text || ':' || tk.id::text || ':' || previous.status || '->' || p_decision || ':' || previous.updated_at::text
        );
      END IF;

      PERFORM bloom_support.log(tk.id, tk.account_id, p_actor, 'feature.decided',
        jsonb_build_object(
          'decision', p_decision,
          'note', p_note,
          'client_followup_queued',
          tk.status <> 'resolved' AND tk.merged_into IS NULL AND NOT tk.spam
            AND tk.redacted_at IS NULL AND tk.automation = 'auto' AND tk.executor = 'bloom'
        ));
    END LOOP;
  END IF;

  RETURN (SELECT to_jsonb(feature) FROM bloom_support.feature_requests feature WHERE feature.id = p_feature);
END
$$;

-- The automation worker is the only principal allowed to turn a shipment
-- subscription into a public Bloom message. This inserts the message and its
-- email job atomically and never updates the ticket row.
CREATE OR REPLACE FUNCTION bloom_support.deliver_feature_shipment(
  p_actor uuid,
  p_subscription uuid,
  p_body text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  s bloom_support.feature_shipment_subscriptions;
  t bloom_support.tickets;
  m bloom_support.messages;
  message_was_new boolean := false;
  email_job uuid;
  ticket_missing boolean;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM bloom_support.principals pr
    WHERE pr.id = p_actor AND pr.active AND pr.kind = 'service'
      AND pr.role = 'service' AND 'automation' = ANY(pr.grants)
  ) THEN
    RAISE EXCEPTION 'forbidden: automation service required' USING ERRCODE = '42501';
  END IF;
  IF length(btrim(coalesce(p_body, ''))) NOT BETWEEN 1 AND 50000 THEN
    RAISE EXCEPTION 'invalid: shipment message required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO s
  FROM bloom_support.feature_shipment_subscriptions
  WHERE id = p_subscription
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found: feature shipment subscription' USING ERRCODE = 'P0002'; END IF;

  SELECT * INTO t FROM bloom_support.tickets WHERE id = s.ticket_id;
  ticket_missing := NOT FOUND;
  IF s.cancelled_at IS NOT NULL THEN
    RETURN jsonb_build_object('delivered', false, 'reason', s.cancellation_reason);
  END IF;
  IF ticket_missing OR t.spam OR t.redacted_at IS NOT NULL OR t.merged_into IS NOT NULL THEN
    UPDATE bloom_support.feature_shipment_subscriptions
    SET cancelled_at = coalesce(cancelled_at, now()),
        cancellation_reason = coalesce(cancellation_reason,
          CASE WHEN ticket_missing THEN 'ticket no longer exists'
               WHEN t.spam THEN 'ticket marked as spam'
               WHEN t.redacted_at IS NOT NULL THEN 'ticket was redacted'
               ELSE 'ticket was merged' END),
        delivery_status = 'suppressed',
        updated_at = now()
    WHERE id = s.id;
    RETURN jsonb_build_object('delivered', false, 'reason', 'ticket cannot receive a shipment notice');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM bloom_support.feature_requests f
    WHERE f.id = s.feature_request_id AND f.status = 'shipped'
  ) THEN
    RETURN jsonb_build_object('delivered', false, 'reason', 'feature is not shipped');
  END IF;

  IF s.notification_message_id IS NOT NULL THEN
    SELECT * INTO m FROM bloom_support.messages WHERE id = s.notification_message_id;
  ELSE
    INSERT INTO bloom_support.messages(
      conversation_id, ticket_id, author_id, author_kind, visibility, direction,
      body, idempotency_key, delivery, purpose, meaningful, notify_client
    ) VALUES (
      t.conversation_id, t.id, p_actor, 'bloom', 'public', 'outbound',
      btrim(p_body), 'feature-shipment:' || s.id::text, 'queued',
      'feature_decision', true, true
    )
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING * INTO m;
    IF FOUND THEN message_was_new := true; END IF;
    IF m.id IS NULL THEN
      SELECT * INTO m FROM bloom_support.messages WHERE idempotency_key = 'feature-shipment:' || s.id::text;
    END IF;
  END IF;

  UPDATE bloom_support.feature_shipment_subscriptions
  SET notification_message_id = m.id,
      notification_queued_at = coalesce(notification_queued_at, now()),
      delivery_status = CASE WHEN delivery_status = 'pending' THEN 'queued' ELSE delivery_status END,
      updated_at = now()
  WHERE id = s.id;

  email_job := bloom_support.enqueue_job(
    'send_email', t.id, NULL, 'email:' || t.id::text,
    jsonb_build_object(
      'purpose', 'feature_decision',
      'message_id', m.id,
      'feature_shipment_subscription_id', s.id
    ),
    'feature-shipment-email:' || s.id::text
  );

  IF message_was_new THEN
    PERFORM bloom_support.log(t.id, t.account_id, p_actor, 'feature.shipment_notified',
      jsonb_build_object('feature_request_id', s.feature_request_id, 'subscription_id', s.id, 'message_id', m.id));
  END IF;
  RETURN jsonb_build_object(
    'delivered', true,
    'duplicate', NOT message_was_new,
    'message_id', m.id,
    'email_job_id', email_job
  );
END
$$;

CREATE OR REPLACE FUNCTION public.bloom_support_deliver_feature_shipment(
  p_actor uuid,
  p_subscription uuid,
  p_body text
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT bloom_support.deliver_feature_shipment(p_actor, p_subscription, p_body)
$$;
REVOKE ALL ON FUNCTION public.bloom_support_deliver_feature_shipment(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bloom_support_deliver_feature_shipment(uuid, uuid, text)
  TO service_role;

-- Customer and staff replies invalidate ordinary queued Bloom work, but an
-- explicit shipment subscription survives. The shipment message and its email
-- job are protected by their relational link, not by a caller-controlled flag.
CREATE OR REPLACE FUNCTION bloom_support.invalidate_planned(p_ticket uuid, p_reason text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE n int;
BEGIN
  UPDATE bloom_support.messages m
  SET delivery = 'suppressed', withdrawn_at = now()
  WHERE m.ticket_id = p_ticket AND m.author_kind = 'bloom'
    AND m.visibility = 'public' AND m.delivery = 'queued'
    AND NOT EXISTS (
      SELECT 1 FROM bloom_support.feature_shipment_subscriptions s
      WHERE s.notification_message_id = m.id AND s.cancelled_at IS NULL
    );

  UPDATE bloom_support.jobs j
  SET status = 'cancelled', last_error = 'invalidated: ' || p_reason, updated_at = now()
  WHERE j.ticket_id = p_ticket AND j.status = 'queued'
    AND (
      (j.kind IN ('answer','operate')
        AND NOT (j.kind = 'answer' AND j.payload->>'mode' = 'feature_shipment'))
      OR (
        j.kind = 'send_email'
        AND EXISTS (
          SELECT 1 FROM bloom_support.messages m
          WHERE m.id = (j.payload->>'message_id')::uuid AND m.author_kind = 'bloom'
        )
        AND NOT EXISTS (
          SELECT 1 FROM bloom_support.feature_shipment_subscriptions s
          WHERE s.notification_message_id = (j.payload->>'message_id')::uuid
            AND s.cancelled_at IS NULL
        )
      )
    );
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n > 0 THEN
    PERFORM bloom_support.log(p_ticket, NULL, NULL, 'automation.invalidated', jsonb_build_object('jobs', n, 'reason', p_reason));
  END IF;
  RETURN n;
END
$$;

-- A shipment notice is the one narrow Bloom-initiated email allowed to cross a
-- later human takeover. It is recognized only by the private subscription's
-- message foreign key; every other Bloom email keeps the takeover suppression.
CREATE OR REPLACE FUNCTION bloom_support.queue_outbound_email(p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  o bloom_support.outbound_emails;
  t bloom_support.tickets;
  v_blocked boolean;
  v_rfc text := p->>'rfc_message_id';
  v_feature_shipment boolean := false;
  v_shipment_message boolean := false;
BEGIN
  v_blocked := EXISTS (
    SELECT 1 FROM bloom_support.outbound_emails b
    WHERE lower(b.to_email) = lower(p->>'to')
      AND (b.status = 'complained' OR (b.status = 'bounced' AND b.created_at > now() - interval '30 days'))
  );
  IF p->>'ticket_id' IS NOT NULL THEN
    SELECT * INTO t FROM bloom_support.tickets WHERE id = (p->>'ticket_id')::uuid;
  END IF;
  IF p->>'message_id' IS NOT NULL THEN
    v_shipment_message := EXISTS (
      SELECT 1 FROM bloom_support.feature_shipment_subscriptions s
      WHERE s.notification_message_id = (p->>'message_id')::uuid
        AND s.ticket_id = (p->>'ticket_id')::uuid
        AND s.cancelled_at IS NULL
    );
    v_feature_shipment := v_shipment_message
      AND t.id IS NOT NULL AND NOT t.spam
      AND t.redacted_at IS NULL AND t.merged_into IS NULL;
    IF v_shipment_message AND NOT v_feature_shipment THEN
      UPDATE bloom_support.feature_shipment_subscriptions
      SET cancelled_at = coalesce(cancelled_at, now()),
          cancellation_reason = coalesce(cancellation_reason,
            CASE WHEN t.id IS NULL THEN 'ticket no longer exists'
                 WHEN t.spam THEN 'ticket marked as spam'
                 WHEN t.redacted_at IS NOT NULL THEN 'ticket was redacted'
                 ELSE 'ticket was merged' END),
          delivery_status = 'suppressed',
          updated_at = now()
      WHERE notification_message_id = (p->>'message_id')::uuid;
    END IF;
  END IF;

  IF p->>'thread_root' IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM bloom_support.outbound_emails x WHERE x.rfc_message_id = p->>'thread_root')
     AND NOT EXISTS (SELECT 1 FROM bloom_support.outbound_emails x WHERE x.idempotency_key = p->>'idempotency_key') THEN
    v_rfc := p->>'thread_root';
  END IF;

  INSERT INTO bloom_support.outbound_emails(
    ticket_id, message_id, purpose, to_email, subject, body, html,
    rfc_message_id, in_reply_to, idempotency_key, cc, covered_message_ids, status
  )
  VALUES (
    (p->>'ticket_id')::uuid, (p->>'message_id')::uuid, p->>'purpose', lower(p->>'to'),
    p->>'subject', p->>'body', p->>'html', v_rfc, p->>'in_reply_to', p->>'idempotency_key',
    coalesce(ARRAY(
      SELECT lower(x) FROM jsonb_array_elements_text(
        CASE WHEN jsonb_typeof(p->'cc') = 'array' THEN p->'cc' ELSE '[]'::jsonb END
      ) x
    ), '{}'),
    coalesce(ARRAY(
      SELECT m.id FROM bloom_support.messages m
      WHERE m.id IN (
        SELECT (x)::uuid FROM jsonb_array_elements_text(
          CASE WHEN jsonb_typeof(p->'covered_message_ids') = 'array' THEN p->'covered_message_ids' ELSE '[]'::jsonb END
        ) x
      )
        AND m.ticket_id = (p->>'ticket_id')::uuid
        AND m.id IS DISTINCT FROM (p->>'message_id')::uuid
    ), '{}'),
    CASE WHEN v_blocked OR (v_shipment_message AND NOT v_feature_shipment) THEN 'suppressed'
         WHEN coalesce((p->>'bloom_initiated')::boolean, false)
           AND t.automation <> 'auto' AND NOT v_feature_shipment THEN 'suppressed'
         ELSE 'queued' END
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING * INTO o;

  IF o.id IS NOT NULL AND o.status = 'suppressed' THEN
    UPDATE bloom_support.outbound_emails
    SET error = CASE WHEN v_blocked THEN 'recipient bounced or complained'
                     WHEN v_shipment_message AND NOT v_feature_shipment THEN 'shipment subscription no longer eligible'
                     ELSE 'ticket under human control' END
    WHERE id = o.id RETURNING * INTO o;
    IF NOT v_blocked AND o.message_id IS NOT NULL THEN
      UPDATE bloom_support.messages
      SET withdrawn_at = coalesce(withdrawn_at, now())
      WHERE (id = o.message_id OR id = ANY(o.covered_message_ids)) AND author_kind = 'bloom';
    END IF;
  END IF;

  IF o.id IS NULL THEN
    SELECT * INTO o FROM bloom_support.outbound_emails WHERE idempotency_key = p->>'idempotency_key';
    IF o.provider_id IS NULL AND o.status IN ('queued','uncertain','failed','not_configured')
       AND EXISTS (
         SELECT 1 FROM bloom_support.outbound_emails b
         WHERE lower(b.to_email) = lower(o.to_email) AND b.id <> o.id
           AND (b.status = 'complained' OR (b.status = 'bounced' AND b.created_at > now() - interval '30 days'))
       ) THEN
      UPDATE bloom_support.outbound_emails
      SET status = 'suppressed', error = 'recipient bounced or complained'
      WHERE id = o.id RETURNING * INTO o;
      RETURN to_jsonb(o) || '{"duplicate":true}';
    END IF;

    IF o.provider_id IS NULL AND o.status IN ('queued','uncertain','failed','not_configured')
       AND v_shipment_message AND NOT v_feature_shipment THEN
      UPDATE bloom_support.outbound_emails
      SET status = 'suppressed', error = 'shipment subscription no longer eligible'
      WHERE id = o.id RETURNING * INTO o;
      UPDATE bloom_support.messages
      SET withdrawn_at = coalesce(withdrawn_at, now())
      WHERE (id = o.message_id OR id = ANY(o.covered_message_ids)) AND author_kind = 'bloom';
      RETURN to_jsonb(o) || '{"duplicate":true}';
    END IF;

    IF o.provider_id IS NULL AND o.status IN ('queued','uncertain','failed','not_configured')
       AND coalesce((p->>'bloom_initiated')::boolean, false)
       AND t.id IS NOT NULL AND t.automation <> 'auto' AND NOT v_feature_shipment THEN
      UPDATE bloom_support.outbound_emails
      SET status = 'suppressed', error = 'ticket under human control'
      WHERE id = o.id RETURNING * INTO o;
      UPDATE bloom_support.messages
      SET withdrawn_at = coalesce(withdrawn_at, now())
      WHERE (id = o.message_id OR id = ANY(o.covered_message_ids)) AND author_kind = 'bloom';
    END IF;
    RETURN to_jsonb(o) || '{"duplicate":true}';
  END IF;
  RETURN to_jsonb(o) || '{"duplicate":false}';
END
$$;

CREATE OR REPLACE FUNCTION bloom_support.sync_feature_shipment_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.delivery IS NOT DISTINCT FROM OLD.delivery THEN RETURN NEW; END IF;
  UPDATE bloom_support.feature_shipment_subscriptions
  SET delivery_status = CASE NEW.delivery
        WHEN 'none' THEN delivery_status
        ELSE NEW.delivery
      END,
      notification_sent_at = CASE
        WHEN NEW.delivery IN ('sent','delivered','bounced','complained')
          THEN coalesce(notification_sent_at, now())
        ELSE notification_sent_at
      END,
      notification_delivered_at = CASE
        WHEN NEW.delivery = 'delivered' THEN coalesce(notification_delivered_at, now())
        ELSE notification_delivered_at
      END,
      updated_at = now()
  WHERE notification_message_id = NEW.id;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS feature_shipment_message_delivery ON bloom_support.messages;
CREATE TRIGGER feature_shipment_message_delivery
AFTER UPDATE OF delivery ON bloom_support.messages
FOR EACH ROW EXECUTE FUNCTION bloom_support.sync_feature_shipment_delivery();

REVOKE ALL ON FUNCTION bloom_support.enqueue_feature_shipment(uuid),
  bloom_support.deliver_feature_shipment(uuid, uuid, text),
  bloom_support.sync_feature_shipment_delivery()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION bloom_support.enqueue_feature_shipment(uuid),
  bloom_support.deliver_feature_shipment(uuid, uuid, text),
  bloom_support.sync_feature_shipment_delivery()
  TO service_role;

-- Existing already-shipped features receive the same durable queue after the
-- schema and delivery functions are in place.
DO $$
DECLARE s record;
BEGIN
  FOR s IN
    SELECT subscription.id
    FROM bloom_support.feature_shipment_subscriptions subscription
    JOIN bloom_support.feature_requests feature ON feature.id = subscription.feature_request_id
    WHERE feature.status = 'shipped' AND subscription.cancelled_at IS NULL
  LOOP
    PERFORM bloom_support.enqueue_feature_shipment(s.id);
  END LOOP;
END
$$;
