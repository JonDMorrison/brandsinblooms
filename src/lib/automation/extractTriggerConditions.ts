/**
 * Extracts trigger conditions from a flow state for database persistence.
 * This ensures that trigger-specific data (segment_id, persona_id, etc.)
 * is properly saved to the crm_automations.trigger_conditions column.
 */

interface FlowState {
  nodes: Array<{
    id: string;
    type: string;
    data?: {
      triggerType?: string;
      conditions?: Record<string, any>;
      [key: string]: any;
    };
    [key: string]: any;
  }>;
  edges: any[];
}

interface TriggerConditions {
  segment_id?: string;
  segment_name?: string;
  persona_id?: string;
  persona_name?: string;
  [key: string]: any;
}

/**
 * Extracts trigger conditions from the trigger node in a flow state.
 * 
 * @param flowState - The flow state containing nodes and edges
 * @returns An object with extracted trigger conditions (segment_id, persona_id, etc.)
 */
export function extractTriggerConditions(flowState: FlowState): TriggerConditions {
  if (!flowState?.nodes) {
    return {};
  }

  // Find the trigger node
  const triggerNode = flowState.nodes.find(n => n.type === 'trigger');
  
  if (!triggerNode?.data) {
    return {};
  }

  const conditions: TriggerConditions = {};
  const nodeData = triggerNode.data;
  const nodeConditions = nodeData.conditions || {};

  // Extract segment_id for segment.added triggers
  if (nodeConditions.segment_id) {
    conditions.segment_id = nodeConditions.segment_id;
    if (nodeConditions.segment_name) {
      conditions.segment_name = nodeConditions.segment_name;
    }
  }

  // Extract persona_id for persona.assigned triggers
  if (nodeConditions.persona_id) {
    conditions.persona_id = nodeConditions.persona_id;
    if (nodeConditions.persona_name) {
      conditions.persona_name = nodeConditions.persona_name;
    }
  }

  // Extract any other custom conditions that might be set
  const excludeKeys = ['segment_id', 'segment_name', 'persona_id', 'persona_name'];
  for (const [key, value] of Object.entries(nodeConditions)) {
    if (!excludeKeys.includes(key) && value !== undefined && value !== null) {
      conditions[key] = value;
    }
  }

  return conditions;
}

/**
 * Validates that required trigger conditions are present for a given trigger type.
 * 
 * @param triggerType - The type of trigger (e.g., 'segment.added', 'persona.assigned')
 * @param conditions - The extracted trigger conditions
 * @returns An object with valid flag and optional error message
 */
export function validateTriggerConditions(
  triggerType: string,
  conditions: TriggerConditions
): { valid: boolean; message?: string } {
  switch (triggerType) {
    case 'segment.added':
    case 'segment_added':
      if (!conditions.segment_id) {
        return { valid: false, message: 'Please select a segment for this trigger' };
      }
      break;

    case 'persona.assigned':
    case 'persona_assigned':
      if (!conditions.persona_id) {
        return { valid: false, message: 'Please select a persona for this trigger' };
      }
      break;

    default:
      // Other triggers don't require specific conditions
      break;
  }

  return { valid: true };
}
