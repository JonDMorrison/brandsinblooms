import { Node, Edge } from '@xyflow/react';

export interface WorkflowStep {
  type: 'email' | 'sms';
  delayMin: number;
  subject?: string;
  text: string;
}

export interface FlowCompilationResult {
  steps: WorkflowStep[];
  warnings: string[];
  hasEmailSteps: boolean;
  hasSMSSteps: boolean;
}

/**
 * Compiles a React Flow graph into a linear sequence of workflow steps
 * @param flowState - The React Flow state with nodes and edges
 * @returns Compiled workflow steps with metadata
 */
export function compileFlow(flowState: { nodes: Node[]; edges: Edge[] }): FlowCompilationResult {
  const { nodes, edges } = flowState;
  const warnings: string[] = [];
  const steps: WorkflowStep[] = [];
  
  if (!nodes || nodes.length === 0) {
    warnings.push('No nodes found in flow');
    return { steps: [], warnings, hasEmailSteps: false, hasSMSSteps: false };
  }

  // Find trigger node (starting point)
  const triggerNode = nodes.find(node => node.type === 'trigger');
  if (!triggerNode) {
    warnings.push('No trigger node found - flow must start with a trigger');
    return { steps: [], warnings, hasEmailSteps: false, hasSMSSteps: false };
  }

  // Build adjacency map from edges
  const adjacencyMap = new Map<string, string[]>();
  edges.forEach(edge => {
    if (!adjacencyMap.has(edge.source)) {
      adjacencyMap.set(edge.source, []);
    }
    adjacencyMap.get(edge.source)!.push(edge.target);
  });

  // Traverse flow starting from trigger, accumulating delays
  let cumulativeDelay = 0;
  const visited = new Set<string>();
  const queue = [{ nodeId: triggerNode.id, delay: 0 }];

  while (queue.length > 0) {
    const { nodeId, delay } = queue.shift()!;
    
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);

    const node = nodes.find(n => n.id === nodeId);
    if (!node) continue;

    // Process current node
    if (node.type === 'delay') {
      // Accumulate delay from delay nodes
      const delayValue = Number(node.data?.delayValue) || 1;
      const delayUnit = String(node.data?.delayUnit) || 'hours';
      
      let delayMinutes = 0;
      switch (delayUnit) {
        case 'minutes':
          delayMinutes = delayValue;
          break;
        case 'hours':
          delayMinutes = delayValue * 60;
          break;
        case 'days':
          delayMinutes = delayValue * 60 * 24;
          break;
        default:
          delayMinutes = delayValue * 60; // Default to hours
      }
      
      cumulativeDelay = delay + delayMinutes;
    } else if (node.type === 'email') {
      // Compile email step
      const subject = String(node.data?.subject || node.data?.title || 'Untitled Email');
      const text = String(node.data?.body || node.data?.content || node.data?.message || '');
      
      if (!text.trim()) {
        warnings.push(`Email node "${subject}" has no content`);
      }

      steps.push({
        type: 'email',
        delayMin: delay,
        subject,
        text
      });

      cumulativeDelay = delay; // Reset for next step
    } else if (node.type === 'sms') {
      // Compile SMS step
      const text = String(node.data?.content || node.data?.message || node.data?.text || '');
      
      if (!text.trim()) {
        warnings.push(`SMS node has no content`);
      }

      if (text.length > 160) {
        warnings.push(`SMS message exceeds 160 characters (${text.length})`);
      }

      steps.push({
        type: 'sms',
        delayMin: delay,
        text
      });

      cumulativeDelay = delay; // Reset for next step
    }

    // Add connected nodes to queue with accumulated delay
    const connectedNodes = adjacencyMap.get(nodeId) || [];
    connectedNodes.forEach(targetId => {
      if (!visited.has(targetId)) {
        queue.push({ nodeId: targetId, delay: cumulativeDelay });
      }
    });
  }

  // Check for unvisited action nodes (disconnected nodes)
  const unvisitedActionNodes = nodes.filter(node => 
    !visited.has(node.id) && 
    (node.type === 'email' || node.type === 'sms')
  );
  
  if (unvisitedActionNodes.length > 0) {
    warnings.push(`${unvisitedActionNodes.length} action node(s) are not connected to the flow`);
  }

  const hasEmailSteps = steps.some(step => step.type === 'email');
  const hasSMSSteps = steps.some(step => step.type === 'sms');

  if (steps.length === 0) {
    warnings.push('No email or SMS steps found in flow');
  }

  return {
    steps,
    warnings,
    hasEmailSteps,
    hasSMSSteps
  };
}

/**
 * Validates that a compiled workflow meets basic requirements
 * @param compilation - The compilation result to validate
 * @returns Validation result with any blocking errors
 */
export function validateCompiledWorkflow(compilation: FlowCompilationResult): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (compilation.steps.length === 0) {
    errors.push('Workflow must contain at least one email or SMS step');
  }

  // Check for steps with empty content
  compilation.steps.forEach((step, index) => {
    if (!step.text.trim()) {
      errors.push(`Step ${index + 1} (${step.type}) has no content`);
    }
    
    if (step.type === 'email' && !step.subject?.trim()) {
      errors.push(`Email step ${index + 1} has no subject`);
    }
  });

  // Check for negative delays (only allowed for birthday triggers)
  const hasNegativeDelays = compilation.steps.some(step => step.delayMin < 0);
  if (hasNegativeDelays) {
    // This will be handled by the executor for birthday triggers
    // For now, just warn but don't block
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Creates a simple flow state for starter pack templates
 */
export function createStarterFlowState(
  triggerId: string, 
  steps: WorkflowStep[]
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Create trigger node
  const triggerNode: Node = {
    id: 'trigger-1',
    type: 'trigger',
    position: { x: 100, y: 100 },
    data: {
      triggerType: triggerId,
      label: `Trigger: ${triggerId}`,
    }
  };
  nodes.push(triggerNode);

  let lastNodeId = triggerNode.id;
  let yPosition = 200;

  // Create nodes for each step
  steps.forEach((step, index) => {
    const stepNodeId = `${step.type}-${index + 1}`;

    // Add delay node if there's a delay
    if (step.delayMin > 0) {
      const delayNodeId = `delay-${index + 1}`;
      const delayNode: Node = {
        id: delayNodeId,
        type: 'delay',
        position: { x: 100, y: yPosition },
        data: {
          delayValue: Math.floor(step.delayMin / 60), // Convert to hours for display
          delayUnit: 'hours'
        }
      };
      nodes.push(delayNode);

      // Connect last node to delay
      edges.push({
        id: `${lastNodeId}-${delayNodeId}`,
        source: lastNodeId,
        target: delayNodeId,
      });

      lastNodeId = delayNodeId;
      yPosition += 100;
    }

    // Create step node
    const stepNode: Node = {
      id: stepNodeId,
      type: step.type,
      position: { x: 100, y: yPosition },
      data: step.type === 'email' ? {
        subject: step.subject,
        body: step.text
      } : {
        content: step.text
      }
    };
    nodes.push(stepNode);

    // Connect to step
    edges.push({
      id: `${lastNodeId}-${stepNodeId}`,
      source: lastNodeId,
      target: stepNodeId,
    });

    lastNodeId = stepNodeId;
    yPosition += 100;
  });

  return { nodes, edges };
}