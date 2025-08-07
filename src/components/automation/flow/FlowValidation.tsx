import React from 'react';
import { AlertCircle, CheckCircle, Users } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Node, Edge } from '@xyflow/react';

interface FlowValidationProps {
  nodes: Node[];
  edges: Edge[];
  selectedAudience?: {
    personas: any[];
    segments: any[];
    totalContacts: number;
  };
}

export const FlowValidation: React.FC<FlowValidationProps> = ({
  nodes,
  edges,
  selectedAudience
}) => {
  const validationResults = validateFlow(nodes, edges, selectedAudience);
  const hasErrors = validationResults.some(result => result.type === 'error');
  const hasWarnings = validationResults.some(result => result.type === 'warning');

  if (validationResults.length === 0) {
    return (
      <Alert className="border-green-200 bg-green-50">
        <CheckCircle className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-800">
          Automation is ready to launch!
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-2">
      {validationResults.map((result, index) => (
        <Alert
          key={index}
          variant={result.type === 'error' ? 'destructive' : 'default'}
          className={result.type === 'warning' ? 'border-yellow-200 bg-yellow-50' : ''}
        >
          <AlertCircle className={`h-4 w-4 ${
            result.type === 'warning' ? 'text-yellow-600' : ''
          }`} />
          <AlertDescription className={
            result.type === 'warning' ? 'text-yellow-800' : ''
          }>
            {result.message}
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
};

function validateFlow(
  nodes: Node[], 
  edges: Edge[], 
  selectedAudience?: { personas: any[]; segments: any[]; totalContacts: number }
) {
  const results: Array<{ type: 'error' | 'warning'; message: string }> = [];

  // Check for trigger node
  const triggerNodes = nodes.filter(node => node.type === 'trigger');
  if (triggerNodes.length === 0) {
    results.push({
      type: 'error',
      message: 'Automation must have a trigger node to start the flow.'
    });
  } else if (triggerNodes.length > 1) {
    results.push({
      type: 'error',
      message: 'Automation can only have one trigger node.'
    });
  }

  // Check for action nodes
  const actionNodes = nodes.filter(node => 
    node.type === 'email' || node.type === 'sms' || node.type === 'delay'
  );
  if (actionNodes.length === 0) {
    results.push({
      type: 'error',
      message: 'Automation must have at least one action (email, SMS, or delay).'
    });
  }

  // Check for disconnected nodes
  const connectedNodeIds = new Set([
    ...edges.map(edge => edge.source),
    ...edges.map(edge => edge.target)
  ]);
  
  const disconnectedNodes = nodes.filter(node => 
    node.type !== 'trigger' && !connectedNodeIds.has(node.id)
  );
  
  if (disconnectedNodes.length > 0) {
    results.push({
      type: 'warning',
      message: `${disconnectedNodes.length} node(s) are not connected to the flow.`
    });
  }

  // Check trigger connections
  const triggerNode = triggerNodes[0];
  if (triggerNode) {
    const triggerConnections = edges.filter(edge => edge.source === triggerNode.id);
    if (triggerConnections.length === 0) {
      results.push({
        type: 'error',
        message: 'Trigger node must be connected to at least one action.'
      });
    }
  }

  // Check audience targeting
  if (!selectedAudience || (
    selectedAudience.personas.length === 0 && 
    selectedAudience.segments.length === 0
  )) {
    results.push({
      type: 'error',
      message: 'Please select target audience (personas or segments) before launching.'
    });
  } else if (selectedAudience.totalContacts === 0) {
    results.push({
      type: 'warning',
      message: 'Selected audience has 0 contacts. Automation will not send to anyone.'
    });
  }

  // Check for incomplete action nodes
  actionNodes.forEach(node => {
    if (node.type === 'email' && (!node.data?.subject || !node.data?.content)) {
      results.push({
        type: 'warning',
        message: `Email node "${node.data?.label || 'Untitled'}" is missing subject or content.`
      });
    }
    
    if (node.type === 'sms' && !node.data?.message) {
      results.push({
        type: 'warning',
        message: `SMS node "${node.data?.label || 'Untitled'}" is missing message content.`
      });
    }
  });

  return results;
}

export const FlowStatusBadge: React.FC<FlowValidationProps> = ({
  nodes,
  edges,
  selectedAudience
}) => {
  const validationResults = validateFlow(nodes, edges, selectedAudience);
  const hasErrors = validationResults.some(result => result.type === 'error');
  const hasWarnings = validationResults.some(result => result.type === 'warning');

  if (hasErrors) {
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertCircle className="w-3 h-3" />
        Needs Fixes
      </Badge>
    );
  }

  if (hasWarnings) {
    return (
      <Badge variant="secondary" className="gap-1 bg-yellow-100 text-yellow-800 border-yellow-300">
        <AlertCircle className="w-3 h-3" />
        Has Warnings
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="gap-1 bg-green-100 text-green-800 border-green-300">
      <CheckCircle className="w-3 h-3" />
      Ready to Launch
    </Badge>
  );
};