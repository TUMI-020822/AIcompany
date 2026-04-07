import React from 'react';
import { AGENTS_DB, DEPT_COLORS } from '../../types';
import type { DAGNode, TaskDAG } from '../../store';
import { ArrowIcon } from '../shared/Icons';

interface Props {
  dag: TaskDAG;
  onNodeClick?: (nodeId: string) => void;
  selectedNodeId?: string | null;
}

/**
 * Group DAG nodes into "layers" for visual rendering.
 * Each layer contains nodes that can run in parallel (same depth in the DAG).
 */
function computeLayers(nodes: DAGNode[]): DAGNode[][] {
  if (nodes.length === 0) return [];

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const depths = new Map<string, number>();

  // Compute depth for each node via topological sort
  function getDepth(nodeId: string, visited: Set<string> = new Set()): number {
    if (depths.has(nodeId)) return depths.get(nodeId)!;
    if (visited.has(nodeId)) return 0; // cycle guard
    visited.add(nodeId);

    const node = nodeMap.get(nodeId);
    if (!node || node.dependencies.length === 0) {
      depths.set(nodeId, 0);
      return 0;
    }

    const maxDepDep = Math.max(...node.dependencies.map((d) => getDepth(d, visited)));
    const depth = maxDepDep + 1;
    depths.set(nodeId, depth);
    return depth;
  }

  for (const node of nodes) {
    getDepth(node.id);
  }

  // Group by depth
  const maxDepth = Math.max(...Array.from(depths.values()));
  const layers: DAGNode[][] = [];
  for (let d = 0; d <= maxDepth; d++) {
    const layerNodes = nodes.filter((n) => depths.get(n.id) === d);
    if (layerNodes.length > 0) {
      layers.push(layerNodes);
    }
  }

  return layers;
}

const DAGNodeComponent: React.FC<{
  node: DAGNode;
  onClick?: () => void;
  selected?: boolean;
}> = ({ node, onClick, selected }) => {
  const agent = AGENTS_DB.find((a) => a.id === node.agentId);
  const statusClass = node.status;
  const dotColors: Record<string, string> = {
    pending: '#dee0e3',
    running: '#3370ff',
    done: '#34c759',
    failed: '#ff3b30',
    skipped: '#8b8fa3',
  };
  const statusText: Record<string, string> = {
    pending: '等待中',
    running: '执行中',
    done: '已完成',
    failed: '失败',
    skipped: '已跳过',
  };

  const avatarColor = DEPT_COLORS[agent?.dept || ''] || '#3370ff';
  const displayName = node.agentName || agent?.name || '?';

  return (
    <div
      className={`dag-node ${selected ? 'selected' : ''}`}
      style={{ cursor: 'pointer' }}
      onClick={onClick}
    >
      <div className={`dag-node-box ${statusClass}`}>
        <div
          className="dag-node-avatar"
          style={{ background: avatarColor }}
        >
          {displayName.charAt(0)}
        </div>
        <div className="dag-node-name">{node.label}</div>
        <div className="dag-node-agent">{displayName}</div>
        <div className="dag-node-status">
          <span className="dot" style={{ background: dotColors[statusClass] || '#dee0e3' }} />
          {statusText[statusClass] || ''}
        </div>
        {node.metadata && node.status === 'done' && (
          <div className="dag-node-meta">
            {(node.metadata.duration / 1000).toFixed(1)}s
          </div>
        )}
      </div>
    </div>
  );
};

const DAGView: React.FC<Props> = ({ dag, onNodeClick, selectedNodeId }) => {
  const layers = computeLayers(dag.nodes);

  const statusLabel: Record<string, string> = {
    planning: '规划中',
    running: '执行中',
    done: '已完成',
    failed: '失败',
  };

  const statusDotColor: Record<string, string> = {
    planning: '#f5a623',
    running: '#3370ff',
    done: '#34c759',
    failed: '#ff3b30',
  };

  return (
    <div className="dag-container fade-in">
      <div className="dag-title">
        <span className="dot" style={{ background: statusDotColor[dag.status] || '#3370ff' }} />
        {statusLabel[dag.status] || dag.status}：{dag.taskName}
        <span style={{ marginLeft: 8, fontSize: 12, color: '#8b8fa3' }}>
          ({dag.nodes.length} 个步骤)
        </span>
      </div>
      <div className="dag-graph">
        {layers.map((layer, i) => (
          <React.Fragment key={i}>
            {layer.length > 1 ? (
              <div className="dag-parallel">
                {layer.map((node) => (
                  <DAGNodeComponent
                    key={node.id}
                    node={node}
                    onClick={() => onNodeClick?.(node.id)}
                    selected={selectedNodeId === node.id}
                  />
                ))}
              </div>
            ) : (
              <DAGNodeComponent
                node={layer[0]}
                onClick={() => onNodeClick?.(layer[0].id)}
                selected={selectedNodeId === layer[0].id}
              />
            )}
            {i < layers.length - 1 && (
              <div className={`dag-arrow ${
                layer.every((n) => n.status === 'done') ? 'active' : ''
              }`}>
                <ArrowIcon />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default DAGView;
