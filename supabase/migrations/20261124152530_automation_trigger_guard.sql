-- workspace-qa3 #7: an automation can only be active when its flow has a
-- trigger node.
--
-- * public.automation_flow_from_legacy converts the legacy trigger_type +
--   trigger_conditions + workflow_steps columns into the editor's flow_state
--   (trigger node, then one node per step, linked in order). The runtime keeps
--   reading workflow_steps; flow_state is what the editor and list show.
-- * A BEFORE INSERT/UPDATE trigger fills an empty flow_state from the legacy
--   columns (the Clover/Square setup wizards still insert legacy rows), then
--   rejects is_active = true when there is still no trigger node.
-- * One-time backfill: the rows with an empty flow_state (4, all Northfield
--   demo automations on 2026-11-24) get their flow from the legacy columns.

CREATE OR REPLACE FUNCTION public.automation_flow_has_trigger(p_flow_state jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(p_flow_state -> 'nodes') = 'array'
        THEN p_flow_state -> 'nodes' ELSE '[]'::jsonb END
    ) AS node
    WHERE node ->> 'type' = 'trigger'
  );
$$;

CREATE OR REPLACE FUNCTION public.automation_flow_from_legacy(
  p_trigger_type text,
  p_trigger_conditions jsonb,
  p_workflow_steps jsonb,
  p_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO ''
AS $$
DECLARE
  v_nodes jsonb := '[]'::jsonb;
  v_edges jsonb := '[]'::jsonb;
  v_previous text := 'trigger-legacy';
  v_step jsonb;
  v_index integer := 0;
  v_id text;
  v_type text;
  v_data jsonb;
  v_template text;
BEGIN
  IF p_trigger_type IS NULL OR btrim(p_trigger_type) = '' THEN
    RETURN NULL;
  END IF;

  v_nodes := v_nodes || jsonb_build_array(jsonb_build_object(
    'id', 'trigger-legacy',
    'type', 'trigger',
    'position', jsonb_build_object('x', 250, 'y', 50),
    'data', jsonb_build_object(
      'label', coalesce(nullif(btrim(p_name), ''), initcap(replace(replace(p_trigger_type, '.', ' '), '_', ' '))),
      'triggerType', p_trigger_type,
      'conditions', coalesce(p_trigger_conditions, '{}'::jsonb)
    )
  ));

  IF jsonb_typeof(p_workflow_steps) = 'array' THEN
    FOR v_step IN SELECT value FROM jsonb_array_elements(p_workflow_steps) LOOP
      v_index := v_index + 1;
      v_type := lower(coalesce(v_step ->> 'type', ''));
      IF v_type IN ('wait', 'delay') THEN
        v_type := 'delay';
        v_data := jsonb_build_object(
          'editable', true,
          'delayUnit', CASE
            WHEN v_step ? 'hours' THEN 'hours'
            WHEN v_step ? 'minutes' THEN 'minutes'
            ELSE 'days' END,
          'delayValue', coalesce(
            (v_step ->> 'days')::numeric,
            (v_step ->> 'hours')::numeric,
            (v_step ->> 'minutes')::numeric,
            (v_step ->> 'delayValue')::numeric,
            1)
        );
      ELSIF v_type IN ('email', 'sms') THEN
        v_template := nullif(btrim(coalesce(v_step ->> 'template', '')), '');
        v_data := (v_step - 'type') || jsonb_build_object(
          'editable', true,
          'subject', coalesce(
            nullif(v_step ->> 'subject', ''),
            CASE WHEN v_type = 'email' AND v_template IS NOT NULL
              THEN initcap(replace(v_template, '_', ' ')) END
          ),
          'content', coalesce(nullif(v_step ->> 'content', ''), nullif(v_step ->> 'body', ''))
        );
        v_data := jsonb_strip_nulls(v_data);
      ELSE
        CONTINUE;
      END IF;

      v_id := v_type || '-legacy-' || v_index;
      v_nodes := v_nodes || jsonb_build_array(jsonb_build_object(
        'id', v_id,
        'type', v_type,
        'position', jsonb_build_object('x', 250, 'y', 50 + v_index * 150),
        'data', v_data
      ));
      v_edges := v_edges || jsonb_build_array(jsonb_build_object(
        'id', 'e-' || v_previous || '-' || v_id,
        'type', 'smoothstep',
        'source', v_previous,
        'target', v_id
      ));
      v_previous := v_id;
    END LOOP;
  END IF;

  RETURN jsonb_build_object('nodes', v_nodes, 'edges', v_edges);
END;
$$;

CREATE OR REPLACE FUNCTION public.crm_automations_require_trigger()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
DECLARE
  v_legacy jsonb;
BEGIN
  IF NOT public.automation_flow_has_trigger(NEW.flow_state)
     AND jsonb_array_length(
       CASE WHEN jsonb_typeof(NEW.flow_state -> 'nodes') = 'array'
         THEN NEW.flow_state -> 'nodes' ELSE '[]'::jsonb END
     ) = 0 THEN
    v_legacy := public.automation_flow_from_legacy(
      NEW.trigger_type, NEW.trigger_conditions, NEW.workflow_steps, NEW.name
    );
    IF v_legacy IS NOT NULL THEN
      NEW.flow_state := v_legacy;
    END IF;
  END IF;

  IF coalesce(NEW.is_active, false)
     AND NOT public.automation_flow_has_trigger(NEW.flow_state) THEN
    RAISE EXCEPTION 'Add a trigger to this automation before turning it on.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER crm_automations_require_trigger
  BEFORE INSERT OR UPDATE ON public.crm_automations
  FOR EACH ROW EXECUTE FUNCTION public.crm_automations_require_trigger();

-- One-time backfill of legacy rows (fires the trigger above).
UPDATE public.crm_automations
SET flow_state = coalesce(flow_state, '{}'::jsonb)
WHERE NOT public.automation_flow_has_trigger(flow_state);
