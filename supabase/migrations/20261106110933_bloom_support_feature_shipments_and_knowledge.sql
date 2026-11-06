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
  current_generation integer NOT NULL DEFAULT 0 CHECK (current_generation >= 0),
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

-- One immutable row per real transition into shipped. Keeping every message
-- linked here means a retracted or superseded generation can never be mistaken
-- for an ordinary Bloom email, even after the subscription moves on.
CREATE TABLE bloom_support.feature_shipment_deliveries (
  subscription_id uuid NOT NULL REFERENCES bloom_support.feature_shipment_subscriptions(id) ON DELETE CASCADE,
  generation integer NOT NULL CHECK (generation > 0),
  notification_message_id uuid UNIQUE REFERENCES bloom_support.messages(id) ON DELETE SET NULL,
  delivery_status text NOT NULL DEFAULT 'pending' CHECK (delivery_status IN (
    'pending','queued','sent','delivered','bounced','complained','failed','suppressed','uncertain'
  )),
  notification_queued_at timestamptz,
  notification_sent_at timestamptz,
  notification_delivered_at timestamptz,
  retracted_at timestamptz,
  retraction_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (subscription_id, generation),
  CHECK ((retracted_at IS NULL) = (retraction_reason IS NULL))
);
CREATE INDEX feature_shipment_deliveries_message
  ON bloom_support.feature_shipment_deliveries(notification_message_id)
  WHERE notification_message_id IS NOT NULL;

ALTER TABLE bloom_support.feature_shipment_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON bloom_support.feature_shipment_deliveries FROM PUBLIC, anon, authenticated;

-- Rebuilds the denormalized current-generation summary from the immutable
-- ledger. Provider callbacks use a non-blocking trigger to avoid lock-order
-- deadlocks; every transaction that can hold the subscription lock calls this
-- before it finishes, so a skipped callback update is repaired deterministically.
CREATE OR REPLACE FUNCTION bloom_support.reconcile_feature_shipment_summary(
  p_subscription uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_generation integer;
  changed integer;
BEGIN
  SELECT s.current_generation INTO v_generation
  FROM bloom_support.feature_shipment_subscriptions s
  WHERE s.id = p_subscription
  FOR UPDATE;
  IF NOT FOUND OR v_generation <= 0 THEN RETURN false; END IF;

  -- A provider callback updates the immutable delivery before it attempts the
  -- non-blocking summary sync. Wait for that row here so a transaction that
  -- already owns the subscription lock cannot reconcile from a stale MVCC
  -- snapshot while the callback is still committing.
  PERFORM 1
  FROM bloom_support.feature_shipment_deliveries d
  WHERE d.subscription_id = p_subscription
    AND d.generation = v_generation
  FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  UPDATE bloom_support.feature_shipment_subscriptions s
  SET notification_message_id = d.notification_message_id,
      notification_queued_at = d.notification_queued_at,
      notification_sent_at = d.notification_sent_at,
      notification_delivered_at = d.notification_delivered_at,
      delivery_status = d.delivery_status,
      updated_at = now()
  FROM bloom_support.feature_shipment_deliveries d
  WHERE s.id = p_subscription
    AND s.current_generation = v_generation
    AND d.subscription_id = s.id
    AND d.generation = v_generation;
  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed > 0;
END
$$;
REVOKE ALL ON FUNCTION bloom_support.reconcile_feature_shipment_summary(uuid)
  FROM PUBLIC, anon, authenticated;

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
  initial_subscription bloom_support.feature_shipment_subscriptions;
  s bloom_support.feature_shipment_subscriptions;
  t bloom_support.tickets;
  attempt bloom_support.feature_shipment_deliveries;
  feature_status text;
  v_generation integer;
  job_id uuid;
  ticket_missing boolean;
BEGIN
  SELECT * INTO initial_subscription
  FROM bloom_support.feature_shipment_subscriptions
  WHERE id = p_subscription;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found: feature shipment subscription' USING ERRCODE = 'P0002';
  END IF;

  SELECT status INTO feature_status
  FROM bloom_support.feature_requests
  WHERE id = initial_subscription.feature_request_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found: feature request' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO t
  FROM bloom_support.tickets
  WHERE id = initial_subscription.ticket_id
  FOR UPDATE;
  ticket_missing := NOT FOUND;

  SELECT * INTO s
  FROM bloom_support.feature_shipment_subscriptions
  WHERE id = p_subscription
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found: feature shipment subscription' USING ERRCODE = 'P0002';
  END IF;
  IF s.feature_request_id IS DISTINCT FROM initial_subscription.feature_request_id
     OR s.ticket_id IS DISTINCT FROM initial_subscription.ticket_id THEN
    RAISE EXCEPTION 'conflict: feature shipment subscription changed' USING ERRCODE = '40001';
  END IF;
  PERFORM bloom_support.reconcile_feature_shipment_summary(s.id);
  IF feature_status IS DISTINCT FROM 'shipped' OR s.cancelled_at IS NOT NULL THEN
    RETURN NULL;
  END IF;
  v_generation := s.current_generation;
  IF v_generation <= 0 THEN RETURN NULL; END IF;

  SELECT * INTO attempt
  FROM bloom_support.feature_shipment_deliveries d
  WHERE d.subscription_id = s.id AND d.generation = v_generation
  FOR UPDATE;
  IF NOT FOUND OR attempt.retracted_at IS NOT NULL THEN RETURN NULL; END IF;

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

  IF attempt.notification_message_id IS NOT NULL THEN
    PERFORM bloom_support.reconcile_feature_shipment_summary(s.id);
    SELECT id INTO job_id
    FROM bloom_support.jobs
    WHERE idempotency_key = 'feature-shipment-email:' || s.id::text || ':' || v_generation::text;
    RETURN job_id;
  END IF;

  job_id := bloom_support.enqueue_job(
    'answer', t.id, NULL,
    'account:' || coalesce(t.account_id::text, 'none:' || t.id::text),
    jsonb_build_object(
      'mode', 'feature_shipment',
      'decision', 'shipped',
      'feature_request_id', s.feature_request_id,
      'subscription_id', s.id,
      'generation', v_generation
    ),
    'feature-shipment:' || s.id::text || ':' || v_generation::text
  );

  UPDATE bloom_support.feature_shipment_deliveries d
  SET notification_queued_at = coalesce(d.notification_queued_at, now()),
      delivery_status = CASE WHEN d.delivery_status = 'pending' THEN 'queued' ELSE d.delivery_status END,
      updated_at = now()
  WHERE d.subscription_id = s.id AND d.generation = v_generation;

  UPDATE bloom_support.feature_shipment_subscriptions
  SET notification_queued_at = coalesce(notification_queued_at, now()),
      delivery_status = CASE WHEN delivery_status = 'pending' THEN 'queued' ELSE delivery_status END,
      updated_at = now()
  WHERE id = s.id;
  PERFORM bloom_support.reconcile_feature_shipment_summary(s.id);
  RETURN job_id;
END
$$;

-- Starts one deterministic shipment generation. Routing an already-shipped
-- feature uses only-if-never so retrying that action cannot create a second
-- notice; a genuine transition back into shipped always increments.
CREATE OR REPLACE FUNCTION bloom_support.begin_feature_shipment_generation(
  p_subscription uuid,
  p_only_if_never boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  initial_subscription bloom_support.feature_shipment_subscriptions;
  s bloom_support.feature_shipment_subscriptions;
  t bloom_support.tickets;
  next_generation integer;
  ticket_missing boolean;
BEGIN
  -- Establish feature -> subscription ordering even when this helper is called
  -- directly by the migration or a service-role recovery.
  SELECT * INTO initial_subscription
  FROM bloom_support.feature_shipment_subscriptions
  WHERE id = p_subscription;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found: feature shipment subscription' USING ERRCODE = 'P0002';
  END IF;
  PERFORM 1
  FROM bloom_support.feature_requests f
  WHERE f.id = initial_subscription.feature_request_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found: feature request' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO t
  FROM bloom_support.tickets
  WHERE id = initial_subscription.ticket_id
  FOR UPDATE;
  ticket_missing := NOT FOUND;

  SELECT * INTO s
  FROM bloom_support.feature_shipment_subscriptions
  WHERE id = p_subscription
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found: feature shipment subscription' USING ERRCODE = 'P0002';
  END IF;
  IF s.feature_request_id IS DISTINCT FROM initial_subscription.feature_request_id
     OR s.ticket_id IS DISTINCT FROM initial_subscription.ticket_id THEN
    RAISE EXCEPTION 'conflict: feature shipment subscription changed' USING ERRCODE = '40001';
  END IF;
  PERFORM bloom_support.reconcile_feature_shipment_summary(s.id);
  IF s.cancelled_at IS NOT NULL OR NOT EXISTS (
    SELECT 1 FROM bloom_support.feature_requests f
    WHERE f.id = s.feature_request_id AND f.status = 'shipped'
  ) THEN
    RETURN NULL;
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
    RETURN NULL;
  END IF;

  IF p_only_if_never AND s.current_generation > 0 AND EXISTS (
    SELECT 1
    FROM bloom_support.feature_shipment_deliveries d
    WHERE d.subscription_id = s.id
      AND d.generation = s.current_generation
      AND d.retracted_at IS NULL
  ) THEN
    RETURN bloom_support.enqueue_feature_shipment(s.id);
  END IF;

  next_generation := s.current_generation + 1;
  INSERT INTO bloom_support.feature_shipment_deliveries(subscription_id, generation)
  VALUES (s.id, next_generation)
  ON CONFLICT (subscription_id, generation) DO NOTHING;

  UPDATE bloom_support.feature_shipment_subscriptions
  SET current_generation = next_generation,
      notification_message_id = NULL,
      notification_queued_at = NULL,
      notification_sent_at = NULL,
      notification_delivered_at = NULL,
      delivery_status = 'pending',
      updated_at = now()
  WHERE id = s.id;

  RETURN bloom_support.enqueue_feature_shipment(s.id);
END
$$;

-- Retracting shipped stops every not-yet-accepted artifact for the current
-- generation. Sent mail remains truthful history because it cannot be unsent;
-- uncertain mail is withdrawn and never retried without pretending the
-- provider outcome is known. A later shipped transition starts a fresh row.
CREATE OR REPLACE FUNCTION bloom_support.retract_feature_shipment_generation(
  p_feature uuid,
  p_reason text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  affected integer;
  v_reason text := coalesce(nullif(btrim(p_reason), ''), 'feature shipment retracted');
BEGIN
  -- Decisions already hold this lock; taking it here also makes direct service
  -- calls obey the feature -> ticket -> subscription ordering contract.
  PERFORM 1
  FROM bloom_support.feature_requests f
  WHERE f.id = p_feature
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found: feature request' USING ERRCODE = 'P0002';
  END IF;

  PERFORM 1
  FROM bloom_support.tickets t
  JOIN bloom_support.feature_shipment_subscriptions s ON s.ticket_id = t.id
  WHERE s.feature_request_id = p_feature
  ORDER BY t.id
  FOR UPDATE OF t;

  PERFORM 1
  FROM bloom_support.feature_shipment_subscriptions s
  WHERE s.feature_request_id = p_feature
  ORDER BY s.id
  FOR UPDATE;

  UPDATE bloom_support.jobs j
  SET status = 'cancelled',
      last_error = 'superseded: ' || left(v_reason, 500),
      updated_at = now()
  WHERE j.status = 'queued'
    AND (
      (j.kind = 'answer' AND j.payload->>'mode' = 'feature_shipment')
      OR j.kind = 'send_email'
    )
    AND EXISTS (
      SELECT 1
      FROM bloom_support.feature_shipment_subscriptions s
      WHERE s.feature_request_id = p_feature
        AND s.id::text = coalesce(
          j.payload->>'subscription_id',
          j.payload->>'feature_shipment_subscription_id'
        )
        AND s.current_generation::text = coalesce(
          j.payload->>'generation',
          j.payload->>'feature_shipment_generation'
        )
    );

  -- Provider-unaccepted rows are safe to suppress. An uncertain row may have
  -- reached the provider, so leave that status truthful while cancelling its
  -- retry job and withdrawing the visible message below.
  UPDATE bloom_support.outbound_emails o
  SET status = 'suppressed',
      error = 'shipment retracted before provider acceptance'
  WHERE o.provider_id IS NULL
    AND o.status IN ('queued', 'failed', 'not_configured')
    AND EXISTS (
      SELECT 1
      FROM bloom_support.feature_shipment_deliveries d
      JOIN bloom_support.feature_shipment_subscriptions s ON s.id = d.subscription_id
      WHERE s.feature_request_id = p_feature
        AND d.generation = s.current_generation
        AND d.notification_message_id = o.message_id
    );

  UPDATE bloom_support.messages m
  SET delivery = CASE WHEN m.delivery IN ('queued','failed') THEN 'suppressed' ELSE m.delivery END,
      withdrawn_at = CASE
        WHEN m.delivery IN ('queued','failed','uncertain') THEN coalesce(m.withdrawn_at, now())
        ELSE m.withdrawn_at
      END
  WHERE EXISTS (
    SELECT 1
    FROM bloom_support.feature_shipment_deliveries d
    JOIN bloom_support.feature_shipment_subscriptions s ON s.id = d.subscription_id
    WHERE s.feature_request_id = p_feature
      AND d.generation = s.current_generation
      AND d.notification_message_id = m.id
  );

  UPDATE bloom_support.feature_shipment_deliveries d
  SET retracted_at = coalesce(d.retracted_at, now()),
      retraction_reason = coalesce(d.retraction_reason, left(v_reason, 500)),
      delivery_status = CASE
        WHEN d.delivery_status IN ('pending','queued','failed') THEN 'suppressed'
        ELSE d.delivery_status
      END,
      updated_at = now()
  FROM bloom_support.feature_shipment_subscriptions s
  WHERE s.id = d.subscription_id
    AND s.feature_request_id = p_feature
    AND d.generation = s.current_generation;

  UPDATE bloom_support.feature_shipment_subscriptions s
  SET delivery_status = d.delivery_status,
      notification_sent_at = d.notification_sent_at,
      notification_delivered_at = d.notification_delivered_at,
      updated_at = now()
  FROM bloom_support.feature_shipment_deliveries d
  WHERE s.feature_request_id = p_feature
    AND s.current_generation > 0
    AND d.subscription_id = s.id
    AND d.generation = s.current_generation;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
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

  -- Serialize routing with decisions so a ticket cannot miss the shipped
  -- generation by observing an older feature status mid-transaction.
  SELECT status INTO feature_status
  FROM bloom_support.feature_requests
  WHERE id = f
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found: feature request' USING ERRCODE = 'P0002'; END IF;

  -- Permanent ticket invalidation holds ticket -> subscription. Re-lock the
  -- authorized ticket here before the subscription upsert so routing always
  -- follows feature -> ticket -> subscription and cannot deadlock with it.
  SELECT * INTO t
  FROM bloom_support.tickets
  WHERE id = p_ticket
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found: ticket' USING ERRCODE = 'P0002'; END IF;

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
  PERFORM bloom_support.reconcile_feature_shipment_summary(subscription_id);

  IF feature_status = 'shipped' THEN
    UPDATE bloom_support.tickets
    SET feature_request_id = f,
        kind = 'feature',
        version = version + 1,
        updated_at = now()
    WHERE id = t.id;
    PERFORM bloom_support.begin_feature_shipment_generation(subscription_id, true);
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

  IF changed AND previous.status = 'shipped' AND p_decision <> 'shipped' THEN
    PERFORM bloom_support.retract_feature_shipment_generation(
      p_feature,
      'feature changed from shipped to ' || p_decision
    );
  END IF;

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
      PERFORM bloom_support.begin_feature_shipment_generation(sub.id, false);
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
  p_generation integer,
  p_body text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  initial_subscription bloom_support.feature_shipment_subscriptions;
  s bloom_support.feature_shipment_subscriptions;
  attempt bloom_support.feature_shipment_deliveries;
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
  IF coalesce(p_generation, 0) <= 0 THEN
    RAISE EXCEPTION 'invalid: shipment generation required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO initial_subscription
  FROM bloom_support.feature_shipment_subscriptions
  WHERE id = p_subscription;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found: feature shipment subscription' USING ERRCODE = 'P0002'; END IF;

  -- Lock the mutable eligibility rows in the same feature -> ticket ->
  -- subscription order used when decisions start or retract a generation.
  PERFORM 1
  FROM bloom_support.feature_requests f
  WHERE f.id = initial_subscription.feature_request_id
  FOR UPDATE;
  SELECT * INTO t
  FROM bloom_support.tickets
  WHERE id = initial_subscription.ticket_id
  FOR UPDATE;
  ticket_missing := NOT FOUND;
  SELECT * INTO s
  FROM bloom_support.feature_shipment_subscriptions
  WHERE id = p_subscription
  FOR UPDATE;
  IF s.feature_request_id IS DISTINCT FROM initial_subscription.feature_request_id
     OR s.ticket_id IS DISTINCT FROM initial_subscription.ticket_id THEN
    RAISE EXCEPTION 'conflict: feature shipment subscription changed' USING ERRCODE = '40001';
  END IF;
  PERFORM bloom_support.reconcile_feature_shipment_summary(s.id);

  SELECT * INTO attempt
  FROM bloom_support.feature_shipment_deliveries d
  WHERE d.subscription_id = s.id AND d.generation = p_generation
  FOR UPDATE;
  IF NOT FOUND OR p_generation <> s.current_generation OR attempt.retracted_at IS NOT NULL THEN
    RETURN jsonb_build_object('delivered', false, 'reason', 'shipment generation is no longer current');
  END IF;

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
    UPDATE bloom_support.feature_shipment_deliveries
    SET retracted_at = coalesce(retracted_at, now()),
        retraction_reason = coalesce(retraction_reason, 'ticket cannot receive a shipment notice'),
        delivery_status = 'suppressed',
        updated_at = now()
    WHERE subscription_id = s.id AND generation = p_generation;
    RETURN jsonb_build_object('delivered', false, 'reason', 'ticket cannot receive a shipment notice');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM bloom_support.feature_requests f
    WHERE f.id = s.feature_request_id AND f.status = 'shipped'
  ) THEN
    RETURN jsonb_build_object('delivered', false, 'reason', 'feature is not shipped');
  END IF;

  IF attempt.notification_message_id IS NOT NULL THEN
    SELECT * INTO m FROM bloom_support.messages WHERE id = attempt.notification_message_id;
  ELSE
    INSERT INTO bloom_support.messages(
      conversation_id, ticket_id, author_id, author_kind, visibility, direction,
      body, idempotency_key, delivery, purpose, meaningful, notify_client
    ) VALUES (
      t.conversation_id, t.id, p_actor, 'bloom', 'public', 'outbound',
      btrim(p_body), 'feature-shipment:' || s.id::text || ':' || p_generation::text, 'queued',
      'feature_decision', true, true
    )
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING * INTO m;
    IF FOUND THEN message_was_new := true; END IF;
    IF m.id IS NULL THEN
      SELECT * INTO m
      FROM bloom_support.messages
      WHERE idempotency_key = 'feature-shipment:' || s.id::text || ':' || p_generation::text;
    END IF;
  END IF;

  UPDATE bloom_support.feature_shipment_deliveries
  SET notification_message_id = m.id,
      notification_queued_at = coalesce(notification_queued_at, now()),
      delivery_status = CASE WHEN delivery_status = 'pending' THEN 'queued' ELSE delivery_status END,
      updated_at = now()
  WHERE subscription_id = s.id AND generation = p_generation;

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
      'feature_shipment_subscription_id', s.id,
      'feature_shipment_generation', p_generation,
      'subscription_id', s.id,
      'generation', p_generation
    ),
    'feature-shipment-email:' || s.id::text || ':' || p_generation::text
  );

  IF message_was_new THEN
    PERFORM bloom_support.log(t.id, t.account_id, p_actor, 'feature.shipment_notified',
      jsonb_build_object('feature_request_id', s.feature_request_id, 'subscription_id', s.id,
        'generation', p_generation, 'message_id', m.id));
  END IF;
  PERFORM bloom_support.reconcile_feature_shipment_summary(s.id);
  RETURN jsonb_build_object(
    'delivered', true,
    'duplicate', NOT message_was_new,
    'generation', p_generation,
    'message_id', m.id,
    'email_job_id', email_job
  );
END
$$;

CREATE OR REPLACE FUNCTION public.bloom_support_deliver_feature_shipment(
  p_actor uuid,
  p_subscription uuid,
  p_generation integer,
  p_body text
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT bloom_support.deliver_feature_shipment(p_actor, p_subscription, p_generation, p_body)
$$;
REVOKE ALL ON FUNCTION public.bloom_support_deliver_feature_shipment(uuid, uuid, integer, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bloom_support_deliver_feature_shipment(uuid, uuid, integer, text)
  TO service_role;

-- Spam, merge and redaction are permanent recipient invalidations. They can
-- update the ticket through several functions, so enforce shipment withdrawal
-- at the ticket boundary instead of relying on every caller to remember it.
CREATE OR REPLACE FUNCTION bloom_support.invalidate_feature_shipment_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_reason text := CASE
    WHEN NEW.spam THEN 'ticket marked as spam'
    WHEN NEW.redacted_at IS NOT NULL THEN 'ticket was redacted'
    ELSE 'ticket was merged'
  END;
BEGIN
  UPDATE bloom_support.jobs j
  SET status = 'cancelled',
      last_error = 'invalidated: ' || v_reason,
      updated_at = now()
  WHERE j.status = 'queued'
    AND j.ticket_id = NEW.id
    AND EXISTS (
      SELECT 1
      FROM bloom_support.feature_shipment_subscriptions s
      WHERE s.ticket_id = NEW.id
        AND s.id::text = coalesce(
          j.payload->>'subscription_id',
          j.payload->>'feature_shipment_subscription_id'
        )
        AND s.current_generation::text = coalesce(
          j.payload->>'generation',
          j.payload->>'feature_shipment_generation'
        )
    );

  UPDATE bloom_support.outbound_emails o
  SET status = 'suppressed', error = v_reason
  WHERE o.provider_id IS NULL
    AND o.status IN ('queued', 'failed', 'not_configured')
    AND EXISTS (
      SELECT 1
      FROM bloom_support.feature_shipment_deliveries d
      JOIN bloom_support.feature_shipment_subscriptions s ON s.id = d.subscription_id
      WHERE s.ticket_id = NEW.id
        AND d.generation = s.current_generation
        AND d.notification_message_id = o.message_id
    );

  UPDATE bloom_support.messages m
  SET delivery = CASE WHEN m.delivery IN ('queued','failed') THEN 'suppressed' ELSE m.delivery END,
      withdrawn_at = CASE
        WHEN m.delivery IN ('queued','failed','uncertain') THEN coalesce(m.withdrawn_at, now())
        ELSE m.withdrawn_at
      END
  WHERE EXISTS (
    SELECT 1
    FROM bloom_support.feature_shipment_deliveries d
    JOIN bloom_support.feature_shipment_subscriptions s ON s.id = d.subscription_id
    WHERE s.ticket_id = NEW.id
      AND d.generation = s.current_generation
      AND d.notification_message_id = m.id
  );

  UPDATE bloom_support.feature_shipment_deliveries d
  SET retracted_at = coalesce(d.retracted_at, now()),
      retraction_reason = coalesce(d.retraction_reason, v_reason),
      delivery_status = CASE
        WHEN d.delivery_status IN ('pending','queued','failed') THEN 'suppressed'
        ELSE d.delivery_status
      END,
      updated_at = now()
  FROM bloom_support.feature_shipment_subscriptions s
  WHERE s.id = d.subscription_id
    AND s.ticket_id = NEW.id
    AND d.generation = s.current_generation;

  UPDATE bloom_support.feature_shipment_subscriptions s
  SET cancelled_at = coalesce(s.cancelled_at, now()),
      cancellation_reason = coalesce(s.cancellation_reason, v_reason),
      delivery_status = coalesce(d.delivery_status, s.delivery_status),
      notification_sent_at = coalesce(d.notification_sent_at, s.notification_sent_at),
      notification_delivered_at = coalesce(d.notification_delivered_at, s.notification_delivered_at),
      updated_at = now()
  FROM bloom_support.feature_shipment_deliveries d
  WHERE s.ticket_id = NEW.id
    AND d.subscription_id = s.id
    AND d.generation = s.current_generation;

  -- Planned features have no generation row yet, but the durable promise must
  -- still be cancelled so a later ship decision cannot revive an invalid
  -- recipient. This also idempotently covers rows updated above.
  UPDATE bloom_support.feature_shipment_subscriptions s
  SET cancelled_at = coalesce(s.cancelled_at, now()),
      cancellation_reason = coalesce(s.cancellation_reason, v_reason),
      delivery_status = CASE
        WHEN s.current_generation = 0 AND s.delivery_status IN ('pending','queued','failed') THEN 'suppressed'
        ELSE s.delivery_status
      END,
      updated_at = now()
  WHERE s.ticket_id = NEW.id;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS feature_shipment_ticket_invalidation ON bloom_support.tickets;
CREATE TRIGGER feature_shipment_ticket_invalidation
AFTER UPDATE OF spam, merged_into, redacted_at ON bloom_support.tickets
FOR EACH ROW
WHEN (
  (NEW.spam AND NOT OLD.spam)
  OR (NEW.merged_into IS NOT NULL AND OLD.merged_into IS NULL)
  OR (NEW.redacted_at IS NOT NULL AND OLD.redacted_at IS NULL)
)
EXECUTE FUNCTION bloom_support.invalidate_feature_shipment_ticket();

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
      SELECT 1
      FROM bloom_support.feature_shipment_deliveries d
      JOIN bloom_support.feature_shipment_subscriptions s ON s.id = d.subscription_id
      JOIN bloom_support.feature_requests f ON f.id = s.feature_request_id
      WHERE d.notification_message_id = m.id
        AND d.generation = s.current_generation
        AND d.retracted_at IS NULL
        AND s.cancelled_at IS NULL
        AND f.status = 'shipped'
    );

  UPDATE bloom_support.jobs j
  SET status = 'cancelled', last_error = 'invalidated: ' || p_reason, updated_at = now()
  WHERE j.ticket_id = p_ticket AND j.status = 'queued'
    AND (
      (j.kind IN ('answer','operate')
        AND NOT (
          j.kind = 'answer'
          AND j.payload->>'mode' = 'feature_shipment'
          AND EXISTS (
            SELECT 1
            FROM bloom_support.feature_shipment_subscriptions s
            JOIN bloom_support.feature_shipment_deliveries d
              ON d.subscription_id = s.id AND d.generation = s.current_generation
            JOIN bloom_support.feature_requests f ON f.id = s.feature_request_id
            WHERE s.id::text = j.payload->>'subscription_id'
              AND s.current_generation::text = j.payload->>'generation'
              AND s.cancelled_at IS NULL
              AND d.retracted_at IS NULL
              AND f.status = 'shipped'
          )
        ))
      OR (
        j.kind = 'send_email'
        AND EXISTS (
          SELECT 1 FROM bloom_support.messages m
          WHERE m.id = (j.payload->>'message_id')::uuid AND m.author_kind = 'bloom'
        )
        AND NOT EXISTS (
          SELECT 1
          FROM bloom_support.feature_shipment_deliveries d
          JOIN bloom_support.feature_shipment_subscriptions s ON s.id = d.subscription_id
          JOIN bloom_support.feature_requests f ON f.id = s.feature_request_id
          WHERE d.notification_message_id = (j.payload->>'message_id')::uuid
            AND d.generation = s.current_generation
            AND d.retracted_at IS NULL
            AND s.cancelled_at IS NULL
            AND f.status = 'shipped'
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
-- later human takeover. It is recognized only by the private generation
-- ledger's message foreign key; every other Bloom email keeps suppression.
CREATE OR REPLACE FUNCTION bloom_support.queue_outbound_email(p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  o bloom_support.outbound_emails;
  t bloom_support.tickets;
  v_blocked boolean;
  v_rfc text := p->>'rfc_message_id';
  v_feature_shipment boolean := false;
  v_shipment_message boolean := false;
  v_shipment_subscription uuid;
  v_shipment_generation integer;
  v_shipment_feature uuid;
  v_shipment_ticket uuid;
  v_subscription_locked boolean := false;
  v_delivery_found boolean := false;
  v_ticket_invalid boolean := false;
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
    -- Resolve immutable identity first, then hold the same feature -> ticket ->
    -- subscription -> delivery lock order as decisions. A rollback can either
    -- suppress this row after it commits or win first and prevent the queue.
    SELECT d.subscription_id, d.generation, s.feature_request_id, s.ticket_id
    INTO v_shipment_subscription, v_shipment_generation, v_shipment_feature, v_shipment_ticket
    FROM bloom_support.feature_shipment_deliveries d
    JOIN bloom_support.feature_shipment_subscriptions s ON s.id = d.subscription_id
    WHERE d.notification_message_id = (p->>'message_id')::uuid;
    v_shipment_message := FOUND;

    IF v_shipment_message THEN
      PERFORM 1
      FROM bloom_support.feature_requests f
      WHERE f.id = v_shipment_feature
      FOR UPDATE;

      SELECT * INTO t
      FROM bloom_support.tickets
      WHERE id = v_shipment_ticket
      FOR UPDATE;

      PERFORM 1
      FROM bloom_support.feature_shipment_subscriptions s
      WHERE s.id = v_shipment_subscription
        AND s.feature_request_id = v_shipment_feature
        AND s.ticket_id = v_shipment_ticket
      FOR UPDATE;
      v_subscription_locked := FOUND;

      IF v_subscription_locked THEN
        SELECT EXISTS (
          SELECT 1
          FROM bloom_support.feature_shipment_deliveries d
          WHERE d.subscription_id = v_shipment_subscription
            AND d.generation = v_shipment_generation
            AND d.notification_message_id = (p->>'message_id')::uuid
        ) INTO v_delivery_found;
      END IF;
    END IF;

    v_ticket_invalid := v_shipment_message AND (
      t.id IS NULL OR t.id::text IS DISTINCT FROM p->>'ticket_id'
      OR t.spam OR t.redacted_at IS NOT NULL OR t.merged_into IS NOT NULL
    );
    v_feature_shipment := v_shipment_message
      AND v_subscription_locked
      AND v_delivery_found
      AND EXISTS (
      SELECT 1
      FROM bloom_support.feature_shipment_deliveries d
      JOIN bloom_support.feature_shipment_subscriptions s ON s.id = d.subscription_id
      JOIN bloom_support.feature_requests f ON f.id = s.feature_request_id
      JOIN bloom_support.messages m ON m.id = d.notification_message_id
      WHERE d.subscription_id = v_shipment_subscription
        AND d.generation = v_shipment_generation
        AND d.generation = s.current_generation
        AND d.retracted_at IS NULL
        AND s.cancelled_at IS NULL
        AND s.ticket_id = (p->>'ticket_id')::uuid
        AND f.status = 'shipped'
        AND t.id IS NOT NULL AND NOT t.spam
        AND t.redacted_at IS NULL AND t.merged_into IS NULL
        AND m.delivery <> 'suppressed' AND m.withdrawn_at IS NULL
    );
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
      WHERE id = v_shipment_subscription AND v_ticket_invalid;
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
    IF o.message_id IS NOT NULL THEN
      UPDATE bloom_support.messages
      SET delivery = CASE
            WHEN v_shipment_message AND delivery IN ('queued','failed') THEN 'suppressed'
            ELSE delivery
          END,
          withdrawn_at = CASE
            WHEN NOT v_blocked OR (v_shipment_message AND NOT v_feature_shipment)
              THEN coalesce(withdrawn_at, now())
            ELSE withdrawn_at
          END
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
      IF v_shipment_message AND o.status = 'uncertain' THEN
        UPDATE bloom_support.outbound_emails
        SET error = 'provider outcome remains unknown; shipment retry suppressed because recipient bounced or complained'
        WHERE id = o.id RETURNING * INTO o;
      ELSE
        UPDATE bloom_support.outbound_emails
        SET status = 'suppressed', error = 'recipient bounced or complained'
        WHERE id = o.id RETURNING * INTO o;
      END IF;
      IF v_shipment_message AND o.message_id IS NOT NULL THEN
        UPDATE bloom_support.messages
        SET delivery = CASE WHEN delivery IN ('queued','failed') THEN 'suppressed' ELSE delivery END
        WHERE id = o.message_id AND author_kind = 'bloom';
      END IF;
      IF v_shipment_message THEN
        PERFORM bloom_support.reconcile_feature_shipment_summary(v_shipment_subscription);
      END IF;
      RETURN to_jsonb(o) || jsonb_build_object(
        'duplicate', true,
        'status', CASE WHEN v_shipment_message THEN 'suppressed' ELSE o.status END
      );
    END IF;

    IF o.provider_id IS NULL AND o.status IN ('queued','uncertain','failed','not_configured')
       AND v_shipment_message AND NOT v_feature_shipment THEN
      IF o.status = 'uncertain' THEN
        UPDATE bloom_support.outbound_emails
        SET error = 'provider outcome remains unknown; shipment generation was retracted and will not retry'
        WHERE id = o.id RETURNING * INTO o;
      ELSE
        UPDATE bloom_support.outbound_emails
        SET status = 'suppressed', error = 'shipment subscription no longer eligible'
        WHERE id = o.id RETURNING * INTO o;
      END IF;
      UPDATE bloom_support.messages
      SET delivery = CASE WHEN delivery IN ('queued','failed') THEN 'suppressed' ELSE delivery END,
          withdrawn_at = coalesce(withdrawn_at, now())
      WHERE (id = o.message_id OR id = ANY(o.covered_message_ids)) AND author_kind = 'bloom';
      PERFORM bloom_support.reconcile_feature_shipment_summary(v_shipment_subscription);
      RETURN to_jsonb(o) || '{"duplicate":true,"status":"suppressed"}';
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
    IF v_shipment_message THEN
      PERFORM bloom_support.reconcile_feature_shipment_summary(v_shipment_subscription);
    END IF;
    RETURN to_jsonb(o) || '{"duplicate":true}';
  END IF;
  IF v_shipment_message THEN
    PERFORM bloom_support.reconcile_feature_shipment_summary(v_shipment_subscription);
  END IF;
  RETURN to_jsonb(o) || '{"duplicate":false}';
END
$$;

-- Final provider-dispatch gate for shipment notices. Queueing and the external
-- HTTP request cannot share a database transaction, so a valid notice is
-- marked uncertain immediately before dispatch. If a rollback wins first this
-- function suppresses the send; if it wins after, history truthfully records
-- that the provider outcome may already be in flight and no retry is allowed.
CREATE OR REPLACE FUNCTION public.bloom_support_claim_feature_shipment_email(p_email uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  outbound bloom_support.outbound_emails;
  attempt bloom_support.feature_shipment_deliveries;
  ticket bloom_support.tickets;
  v_message uuid;
  v_subscription uuid;
  v_generation integer;
  v_feature uuid;
  v_ticket uuid;
  v_subscription_locked boolean := false;
  v_ticket_missing boolean := false;
  v_valid boolean := false;
BEGIN
  SELECT o.message_id, d.subscription_id, d.generation, s.feature_request_id, s.ticket_id
  INTO v_message, v_subscription, v_generation, v_feature, v_ticket
  FROM bloom_support.outbound_emails o
  JOIN bloom_support.feature_shipment_deliveries d ON d.notification_message_id = o.message_id
  JOIN bloom_support.feature_shipment_subscriptions s ON s.id = d.subscription_id
  WHERE o.id = p_email;

  -- Ordinary email is outside this narrow gate and keeps existing behaviour.
  IF NOT FOUND THEN RETURN true; END IF;

  PERFORM 1 FROM bloom_support.feature_requests f WHERE f.id = v_feature FOR UPDATE;
  SELECT * INTO ticket FROM bloom_support.tickets WHERE id = v_ticket FOR UPDATE;
  v_ticket_missing := NOT FOUND;

  PERFORM 1
  FROM bloom_support.feature_shipment_subscriptions s
  WHERE s.id = v_subscription
    AND s.feature_request_id = v_feature
    AND s.ticket_id = v_ticket
  FOR UPDATE;
  v_subscription_locked := FOUND;

  SELECT * INTO outbound
  FROM bloom_support.outbound_emails o
  WHERE o.id = p_email
  FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  IF v_subscription_locked THEN
    SELECT * INTO attempt
    FROM bloom_support.feature_shipment_deliveries d
    WHERE d.subscription_id = v_subscription
      AND d.generation = v_generation
      AND d.notification_message_id = v_message
    FOR UPDATE;
    PERFORM bloom_support.reconcile_feature_shipment_summary(v_subscription);
  END IF;

  IF outbound.provider_id IS NOT NULL
     OR outbound.status NOT IN ('queued','failed','not_configured','uncertain') THEN
    RETURN false;
  END IF;

  v_valid := v_subscription_locked
    AND attempt.subscription_id IS NOT NULL
    AND attempt.retracted_at IS NULL
    AND NOT v_ticket_missing
    AND NOT ticket.spam
    AND ticket.redacted_at IS NULL
    AND ticket.merged_into IS NULL
    AND outbound.ticket_id = v_ticket
    AND EXISTS (
      SELECT 1
      FROM bloom_support.feature_shipment_subscriptions s
      JOIN bloom_support.feature_requests f ON f.id = s.feature_request_id
      JOIN bloom_support.messages m ON m.id = outbound.message_id
      WHERE s.id = v_subscription
        AND s.current_generation = v_generation
        AND s.cancelled_at IS NULL
        AND f.status = 'shipped'
        AND m.delivery <> 'suppressed'
        AND m.withdrawn_at IS NULL
    );

  IF NOT v_valid THEN
    UPDATE bloom_support.feature_shipment_deliveries
    SET retracted_at = coalesce(retracted_at, now()),
        retraction_reason = coalesce(retraction_reason, 'shipment generation no longer eligible before dispatch'),
        delivery_status = CASE
          WHEN delivery_status IN ('pending','queued','failed') THEN 'suppressed'
          ELSE delivery_status
        END,
        updated_at = now()
    WHERE subscription_id = v_subscription AND generation = v_generation;

    IF outbound.status <> 'uncertain' THEN
      UPDATE bloom_support.outbound_emails
      SET status = 'suppressed', error = 'shipment subscription no longer eligible'
      WHERE id = outbound.id;
    ELSE
      UPDATE bloom_support.outbound_emails
      SET error = 'provider outcome remains unknown; shipment generation was retracted and will not retry'
      WHERE id = outbound.id;
    END IF;

    UPDATE bloom_support.messages
    SET delivery = CASE WHEN delivery IN ('queued','failed') THEN 'suppressed' ELSE delivery END,
        withdrawn_at = coalesce(withdrawn_at, now())
    WHERE id = outbound.message_id AND author_kind = 'bloom';
    PERFORM bloom_support.reconcile_feature_shipment_summary(v_subscription);
    RETURN false;
  END IF;

  UPDATE bloom_support.outbound_emails
  SET status = 'uncertain',
      error = 'provider dispatch started; outcome not yet known'
  WHERE id = outbound.id;
  UPDATE bloom_support.messages
  SET delivery = 'uncertain'
  WHERE id = outbound.message_id
    AND author_kind = 'bloom'
    AND delivery IN ('queued','failed','uncertain');
  UPDATE bloom_support.feature_shipment_deliveries
  SET delivery_status = 'uncertain', updated_at = now()
  WHERE subscription_id = v_subscription
    AND generation = v_generation
    AND retracted_at IS NULL
    AND delivery_status IN ('pending','queued','failed','uncertain');
  PERFORM bloom_support.reconcile_feature_shipment_summary(v_subscription);
  RETURN true;
END
$$;

REVOKE ALL ON FUNCTION public.bloom_support_claim_feature_shipment_email(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bloom_support_claim_feature_shipment_email(uuid)
  TO service_role;

-- A requester without an email address still receives the public in-product
-- update. Mark that delivery path terminal so the generation is not left
-- looking queued forever and cannot accumulate an unrecoverable email retry.
CREATE OR REPLACE FUNCTION public.bloom_support_mark_feature_shipment_in_product_only(
  p_message uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_subscription uuid;
  v_generation integer;
  v_feature uuid;
  v_ticket uuid;
  current_subscription bloom_support.feature_shipment_subscriptions;
  current_attempt bloom_support.feature_shipment_deliveries;
BEGIN
  SELECT d.subscription_id, d.generation, s.feature_request_id, s.ticket_id
  INTO v_subscription, v_generation, v_feature, v_ticket
  FROM bloom_support.feature_shipment_deliveries d
  JOIN bloom_support.feature_shipment_subscriptions s ON s.id = d.subscription_id
  WHERE d.notification_message_id = p_message;
  IF NOT FOUND THEN RETURN false; END IF;

  PERFORM 1 FROM bloom_support.feature_requests f WHERE f.id = v_feature FOR UPDATE;
  PERFORM 1 FROM bloom_support.tickets t WHERE t.id = v_ticket FOR UPDATE;
  SELECT * INTO current_subscription
  FROM bloom_support.feature_shipment_subscriptions s
  WHERE s.id = v_subscription
  FOR UPDATE;
  IF current_subscription.id IS NOT NULL THEN
    PERFORM bloom_support.reconcile_feature_shipment_summary(v_subscription);
  END IF;
  SELECT * INTO current_attempt
  FROM bloom_support.feature_shipment_deliveries d
  WHERE d.subscription_id = v_subscription AND d.generation = v_generation
  FOR UPDATE;

  IF current_subscription.id IS NULL
     OR current_attempt.subscription_id IS NULL
     OR current_subscription.current_generation <> v_generation
     OR current_attempt.retracted_at IS NOT NULL
     OR current_attempt.notification_message_id IS DISTINCT FROM p_message THEN
    RETURN false;
  END IF;

  UPDATE bloom_support.messages
  SET delivery = 'suppressed'
  WHERE id = p_message
    AND author_kind = 'bloom'
    AND delivery IN ('queued','failed');
  UPDATE bloom_support.feature_shipment_deliveries
  SET delivery_status = 'suppressed', updated_at = now()
  WHERE subscription_id = v_subscription
    AND generation = v_generation
    AND delivery_status IN ('pending','queued','failed');
  PERFORM bloom_support.reconcile_feature_shipment_summary(v_subscription);
  RETURN true;
END
$$;

REVOKE ALL ON FUNCTION public.bloom_support_mark_feature_shipment_in_product_only(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bloom_support_mark_feature_shipment_in_product_only(uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION bloom_support.sync_feature_shipment_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.delivery IS NOT DISTINCT FROM OLD.delivery THEN RETURN NEW; END IF;
  UPDATE bloom_support.feature_shipment_deliveries
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

  -- A provider event for an older generation is still valuable history, but
  -- it must never overwrite the summary for a later re-shipment.
  WITH unlocked_subscription AS (
    SELECT s.id
    FROM bloom_support.feature_shipment_subscriptions s
    JOIN bloom_support.feature_shipment_deliveries d
      ON d.subscription_id = s.id AND d.generation = s.current_generation
    WHERE d.notification_message_id = NEW.id
    FOR UPDATE OF s SKIP LOCKED
  )
  UPDATE bloom_support.feature_shipment_subscriptions s
  SET delivery_status = d.delivery_status,
      notification_sent_at = d.notification_sent_at,
      notification_delivered_at = d.notification_delivered_at,
      updated_at = now()
  FROM bloom_support.feature_shipment_deliveries d, unlocked_subscription unlocked
  WHERE d.notification_message_id = NEW.id
    AND d.subscription_id = s.id
    AND d.generation = s.current_generation
    AND unlocked.id = s.id;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS feature_shipment_message_delivery ON bloom_support.messages;
CREATE TRIGGER feature_shipment_message_delivery
AFTER UPDATE OF delivery ON bloom_support.messages
FOR EACH ROW EXECUTE FUNCTION bloom_support.sync_feature_shipment_delivery();

REVOKE ALL ON FUNCTION bloom_support.enqueue_feature_shipment(uuid),
  bloom_support.begin_feature_shipment_generation(uuid, boolean),
  bloom_support.retract_feature_shipment_generation(uuid, text),
  bloom_support.deliver_feature_shipment(uuid, uuid, integer, text),
  bloom_support.invalidate_feature_shipment_ticket(),
  bloom_support.reconcile_feature_shipment_summary(uuid),
  bloom_support.sync_feature_shipment_delivery()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION bloom_support.enqueue_feature_shipment(uuid),
  bloom_support.deliver_feature_shipment(uuid, uuid, integer, text),
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
    PERFORM bloom_support.begin_feature_shipment_generation(s.id, true);
  END LOOP;
END
$$;
