/**
 * Utility functions for automation flow layout and node positioning
 */

export interface Position {
  x: number;
  y: number;
}

export interface FlowNode {
  id: string;
  type: string;
  position: Position;
  data: any;
}

/**
 * Calculate optimal node positions for a linear flow
 * @param nodeCount Number of nodes in the flow
 * @param startPosition Starting position for the first node
 * @param direction Direction of the flow ('vertical' | 'diagonal')
 * @returns Array of positions for each node
 */
export const calculateLinearLayout = (
  nodeCount: number,
  startPosition: Position = { x: 50, y: 50 },
  direction: 'vertical' | 'diagonal' = 'diagonal'
): Position[] => {
  const positions: Position[] = [];
  const baseSpacing = 230; // Increased spacing between nodes
  
  for (let i = 0; i < nodeCount; i++) {
    if (direction === 'vertical') {
      positions.push({
        x: startPosition.x,
        y: startPosition.y + (i * baseSpacing)
      });
    } else {
      // Diagonal layout for better visual flow
      positions.push({
        x: startPosition.x + (i * 30), // Slight horizontal offset
        y: startPosition.y + (i * baseSpacing)
      });
    }
  }
  
  return positions;
};

/**
 * Calculate positions for a branching flow with splits
 * @param mainBranchCount Number of nodes in the main branch
 * @param branches Array of branch configurations
 * @param startPosition Starting position
 * @returns Object with positions for main branch and all branches
 */
export const calculateBranchingLayout = (
  mainBranchCount: number,
  branches: { nodeCount: number; branchIndex: number }[],
  startPosition: Position = { x: 100, y: 50 }
): {
  mainBranch: Position[];
  branches: { [key: number]: Position[] };
} => {
  const mainSpacing = 230;
  const branchSpacing = 280;
  const horizontalOffset = 200;
  
  // Calculate main branch positions
  const mainBranch = calculateLinearLayout(mainBranchCount, startPosition, 'diagonal');
  
  // Calculate branch positions
  const branchPositions: { [key: number]: Position[] } = {};
  
  branches.forEach(({ nodeCount, branchIndex }) => {
    const branchStartY = startPosition.y + mainSpacing; // Start after the split node
    const branchStartX = startPosition.x + (branchIndex * horizontalOffset);
    
    branchPositions[branchIndex] = calculateLinearLayout(
      nodeCount,
      { x: branchStartX, y: branchStartY },
      'vertical'
    );
  });
  
  return {
    mainBranch,
    branches: branchPositions
  };
};

/**
 * Apply better spacing to existing node positions
 * @param nodes Array of nodes to reposition
 * @param layoutType Type of layout to apply
 * @returns Updated nodes with improved positions
 */
export const improveNodeSpacing = (
  nodes: FlowNode[],
  layoutType: 'linear' | 'branching' = 'linear'
): FlowNode[] => {
  if (nodes.length === 0) return nodes;
  
  const updatedNodes = [...nodes];
  
  if (layoutType === 'linear') {
    const positions = calculateLinearLayout(nodes.length);
    updatedNodes.forEach((node, index) => {
      node.position = positions[index];
    });
  }
  
  return updatedNodes;
};

/**
 * Calculate canvas bounds for fitView
 * @param nodes Array of nodes
 * @returns Bounds object with min/max x and y values
 */
export const calculateCanvasBounds = (nodes: FlowNode[]) => {
  if (nodes.length === 0) {
    return { minX: 0, maxX: 500, minY: 0, maxY: 500 };
  }
  
  const positions = nodes.map(n => n.position);
  const minX = Math.min(...positions.map(p => p.x)) - 100;
  const maxX = Math.max(...positions.map(p => p.x)) + 300;
  const minY = Math.min(...positions.map(p => p.y)) - 100;
  const maxY = Math.max(...positions.map(p => p.y)) + 200;
  
  return { minX, maxX, minY, maxY };
};