import { useCallback, useRef, useEffect, useState } from 'react';
import {
  ReactFlow,
  Background,
  MiniMap,
  Controls,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  type OnConnect,
  type NodeTypes,
  type ReactFlowInstance,
  type OnSelectionChangeParams,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Trash2 } from 'lucide-react';

import CustomNode from './CustomNode';
import { getNodeDefinition } from '../../lib/node-definitions';
import { useExecutionStore } from '../../stores/execution-store';
import { useWorkflowStore } from '../../stores/workflow-store';
import type { WorkflowNode, WorkflowEdge } from '../../../../shared/types';

const nodeTypes: NodeTypes = {
  custom: CustomNode,
};

const miniMapNodeColor = (node: any) => {
  const colors: Record<string, string> = {
    trigger: 'var(--node-trigger)',
    action: 'var(--node-action)',
    logic: 'var(--node-logic)',
  };
  return colors[(node.data as any)?.category] || 'var(--border)';
};

interface FlowCanvasProps {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  onNodesChange: (nodes: WorkflowNode[]) => void;
  onEdgesChange: (edges: WorkflowEdge[]) => void;
  onNodeSelect: (nodeId: string | null) => void;
}

export default function FlowCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onNodeSelect,
}: FlowCanvasProps) {
  const [colorMode, setColorMode] = useState<'dark' | 'light'>(() =>
    document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'
  );
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setColorMode(document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);
  const currentExecutionId = useExecutionStore(s => s.currentExecutionId);
  const nodeStatuses = useExecutionStore(s => s.nodeStatuses);

  // 执行状态通过 ref 追踪，用 setNodes 更新 ReactFlow 内部状态
  // 不更新 store，避免触发渲染阶段同步覆盖
  const executionStatusesRef = useRef<Record<string, string>>({});

  useEffect(() => {
    const latest = currentExecutionId ? nodeStatuses[currentExecutionId] || {} : {};
    const prev = executionStatusesRef.current;
    const prevKeys = Object.keys(prev);
    const nextKeys = Object.keys(latest);
    let changed = prevKeys.length !== nextKeys.length;
    if (!changed) {
      for (const k of nextKeys) {
        if (prev[k] !== latest[k]) { changed = true; break; }
      }
    }
    if (changed) {
      executionStatusesRef.current = latest;
      // 命令式更新 ReactFlow 内部节点
      const instance = reactFlowInstance.current;
      if (instance) {
        instance.setNodes(nds => nds.map(n => {
          const status = latest[n.id] || 'idle';
          if ((n.data as any).executionStatus === status) return n;
          return { ...n, data: { ...n.data, executionStatus: status } };
        }));
      }
    }
  }, [currentExecutionId, nodeStatuses]);

  // 节点状态：localNodes 是 source of truth
  // 直接从 nodes 初始化，确保 ReactFlow 挂载时 defaultNodes 就有数据
  const [localNodes, setLocalNodes] = useState<WorkflowNode[]>(() => {
    const statuses = executionStatusesRef.current;
    return nodes.map(n => {
      const status = statuses[n.id] || 'idle';
      if ((n.data as any).executionStatus !== status) {
        return { ...n, data: { ...n.data, executionStatus: status } };
      }
      return n;
    });
  });
  const draggingRef = useRef(false);
  const didFitView = useRef(false);
  // 标记变化来源：true=用户拖拽/编辑，false=父组件推送
  const changedFromUserRef = useRef(false);

  // 用节点 ID 列表作为"工作流指纹"，切换工作流时重置并重新初始化 localNodes
  const nodesKey = nodes.map(n => n.id).join(',');
  const prevNodesKeyRef = useRef(nodesKey);
  if (nodesKey !== prevNodesKeyRef.current) {
    prevNodesKeyRef.current = nodesKey;
    didFitView.current = false;
    // key 变化 = 切换工作流，用 nodes prop 重新初始化 localNodes
    changedFromUserRef.current = false;
    const statuses = executionStatusesRef.current;
    const sanitized = nodes.map(n => {
      const status = statuses[n.id] || 'idle';
      if ((n.data as any).executionStatus !== status) {
        return { ...n, data: { ...n.data, executionStatus: status } };
      }
      return n;
    });
    setLocalNodes(sanitized);
  }

  // 父组件 nodes 数据变化（非 key 变化）时同步到 localNodes
  const prevNodesRef = useRef(nodes);
  if (nodesKey === prevNodesKeyRef.current && !changedFromUserRef.current && nodes !== prevNodesRef.current) {
    prevNodesRef.current = nodes;
    const statuses = executionStatusesRef.current;
    const sanitized = nodes.map(n => {
      const status = statuses[n.id] || 'idle';
      if ((n.data as any).executionStatus !== status) {
        return { ...n, data: { ...n.data, executionStatus: status } };
      }
      return n;
    });
    setLocalNodes(sanitized);
  }
  prevNodesRef.current = nodes;

  // 带重试的 fitView
  const tryFitView = useCallback((attempt = 0) => {
    const instance = reactFlowInstance.current;
    if (!instance || didFitView.current) return;
    const domNodes = instance.getNodes();
    if (domNodes.length === 0 && attempt < 10) {
      setTimeout(() => tryFitView(attempt + 1), 100);
      return;
    }
    if (domNodes.length > 0) {
      didFitView.current = true;
      instance.fitView({ padding: 0.3, duration: 400 });
    }
  }, []);

  // 父组件 nodes 变化 → fitView（localNodes 已在渲染阶段同步）
  const onNodesChangeRef = useRef(onNodesChange);
  onNodesChangeRef.current = onNodesChange;

  useEffect(() => {
    if (nodes.length > 0 && !didFitView.current) {
      setTimeout(() => tryFitView(), 100);
    }
  }, [nodes, tryFitView]);

  // localNodes 变化 → 同步到父组件（合并执行状态）
  useEffect(() => {
    if (!draggingRef.current) {
      changedFromUserRef.current = true;
      // 合并执行状态，确保 store 中也保留
      const statuses = executionStatusesRef.current;
      const merged = localNodes.map(n => {
        const status = statuses[n.id] || 'idle';
        if ((n.data as any).executionStatus === status) return n;
        return { ...n, data: { ...n.data, executionStatus: status } };
      });
      onNodesChangeRef.current(merged);
      // 重置标记，允许下次父组件更新时同步
      requestAnimationFrame(() => {
        changedFromUserRef.current = false;
      });
    }
  }, [localNodes]);

  // Copy/Paste: track selected nodes and clipboard
  const selectedNodeIdsRef = useRef<Set<string>>(new Set());
  const clipboardRef = useRef<{ nodes: WorkflowNode[]; edges: WorkflowEdge[] } | null>(null);

  const onSelectionChange = useCallback((params: OnSelectionChangeParams) => {
    selectedNodeIdsRef.current = new Set(params.nodes.map((n: any) => n.id));
  }, []);

  // Copy/Paste keyboard handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === 'c') {
        const selectedIds = selectedNodeIdsRef.current;
        if (selectedIds.size === 0) return;
        const selectedNodes = localNodes.filter(n => selectedIds.has(n.id));
        const internalEdges = edgesRef.current.filter(
          e => selectedIds.has(e.source) && selectedIds.has(e.target)
        );
        clipboardRef.current = { nodes: selectedNodes, edges: internalEdges };
      } else if (mod && e.key === 'v') {
        const clip = clipboardRef.current;
        if (!clip || clip.nodes.length === 0) return;
        const now = Date.now();
        const idMap = new Map<string, string>();
        clip.nodes.forEach((n, i) => {
          idMap.set(n.id, `${n.data.nodeType || n.id.split('_')[0]}_${now + i}`);
        });
        const newNodes: WorkflowNode[] = clip.nodes.map((n, i) => ({
          ...n,
          id: idMap.get(n.id)!,
          position: { x: n.position.x + 20, y: n.position.y + 20 },
          data: { ...n.data },
        }));
        const newEdges: WorkflowEdge[] = clip.edges.map((e, i) => ({
          ...e,
          id: `e_${idMap.get(e.source)}_${idMap.get(e.target)}_${i}`,
          source: idMap.get(e.source)!,
          target: idMap.get(e.target)!,
        }));
        setLocalNodes(prev => [
          ...prev.map(n => ({ ...n, selected: false })),
          ...newNodes.map(n => ({ ...n, selected: true })),
        ]);
        onEdgesChange([...edgesRef.current, ...newEdges]);
        clipboardRef.current = { nodes: newNodes, edges: newEdges };
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [localNodes, onEdgesChange]);

  const edgesRef = useRef(edges);
  useEffect(() => { edgesRef.current = edges; }, [edges]);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; type: 'node' | 'edge'; id: string } | null>(null);

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);

  const onConnect: OnConnect = useCallback(
    (connection) => {
      if (connection.source === connection.target) return;
      const exists = edgesRef.current.some(
        (e) => e.source === connection.source && e.target === connection.target
      );
      if (exists) return;

      const newEdges = addEdge({ ...connection, animated: true }, edgesRef.current as any[]);
      onEdgesChange(newEdges as WorkflowEdge[]);
    },
    [onEdgesChange]
  );

  const handleNodesChange = useCallback((changes: any[]) => {
    const isDrag = changes.some((c: any) => c.type === 'position' && c.dragging);

    if (isDrag) {
      draggingRef.current = true;
    } else {
      draggingRef.current = false;
    }

    // 标记为用户操作，阻止 nodes effect 回写
    changedFromUserRef.current = true;

    setLocalNodes(prev => {
      const updated = applyNodeChanges(changes, prev as any[]) as WorkflowNode[];
      const statuses = executionStatusesRef.current;
      return updated.map(n => {
        const x = Number.isFinite(n.position?.x) ? n.position.x : 0;
        const y = Number.isFinite(n.position?.y) ? n.position.y : 0;
        let node = n;
        // 保留执行状态
        const status = statuses[n.id] || 'idle';
        if ((n.data as any).executionStatus !== status) {
          node = { ...node, data: { ...node.data, executionStatus: status } };
        }
        if (x !== n.position?.x || y !== n.position?.y) {
          node = { ...node, position: { x, y } };
        }
        return node;
      });
    });
  }, []);

  const handleEdgesChange = useCallback((changes: any[]) => {
    const updated = applyEdgeChanges(changes, edgesRef.current as any[]);
    onEdgesChange(updated as WorkflowEdge[]);
  }, [onEdgesChange]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: any) => {
      onNodeSelect(node.id);
    },
    [onNodeSelect]
  );

  const onPaneClick = useCallback(() => {
    onNodeSelect(null);
    setContextMenu(null);
  }, [onNodeSelect]);

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: any) => {
      event.preventDefault();
      setContextMenu({ x: event.clientX, y: event.clientY, type: 'node', id: node.id });
    },
    []
  );

  const onEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: any) => {
      event.preventDefault();
      setContextMenu({ x: event.clientX, y: event.clientY, type: 'edge', id: edge.id });
    },
    []
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      setContextMenu(null);
      changedFromUserRef.current = true;
      setLocalNodes(prev => prev.filter((n) => n.id !== nodeId));
      onEdgesChange(
        edgesRef.current.filter((e) => e.source !== nodeId && e.target !== nodeId)
      );
    },
    [onEdgesChange]
  );

  const deleteEdge = useCallback(
    (edgeId: string) => {
      setContextMenu(null);
      onEdgesChange(edgesRef.current.filter((e) => e.id !== edgeId));
    },
    [onEdgesChange]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow-type');
      const category = event.dataTransfer.getData('application/reactflow-category');
      const label = event.dataTransfer.getData('application/reactflow-label');
      const icon = event.dataTransfer.getData('application/reactflow-icon');
      const color = event.dataTransfer.getData('application/reactflow-color');

      if (!type || !reactFlowInstance.current) return;

      const position = reactFlowInstance.current.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const definition = getNodeDefinition(type);
      const newNode: WorkflowNode = {
        id: `${type}_${Date.now()}`,
        type: 'custom',
        position,
        data: {
          label,
          nodeType: type,
          category,
          icon,
          color,
          ...(definition?.defaultData || {}),
        },
      };

      changedFromUserRef.current = true;
      setLocalNodes(prev => [...prev, newNode]);
    },
    []
  );

  const onInit = useCallback((instance: ReactFlowInstance) => {
    reactFlowInstance.current = instance;
    if (localNodes.length > 0) {
      tryFitView();
    }
  }, [tryFitView]);

  // 确保所有 edges 都有 animated 属性（兼容旧数据）
  const edgesWithDefaults = edges.map(e => e.animated === undefined ? { ...e, animated: true } : e);

  return (
    <div className="w-full h-full">
      <ReactFlow
        key={nodesKey}
        defaultNodes={localNodes as any[]}
        edges={edgesWithDefaults as any[]}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onSelectionChange={onSelectionChange}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeContextMenu={onEdgeContextMenu}
        onPaneClick={onPaneClick}
        onInit={onInit}
        onDragOver={onDragOver}
        onDrop={onDrop}
        nodeTypes={nodeTypes}
        deleteKeyCode={['Backspace', 'Delete']}
        defaultEdgeOptions={{ animated: true }}
        snapToGrid
        snapGrid={[4, 4]}
        minZoom={0.3}
        maxZoom={2}
        colorMode={colorMode}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="var(--border)"
        />
        <MiniMap
          nodeColor={miniMapNodeColor}
          maskColor={colorMode === 'light' ? 'rgba(245, 246, 250, 0.8)' : 'rgba(15, 17, 23, 0.8)'}
        />
        <Controls />
      </ReactFlow>

      {contextMenu && (
        <div
          className="fixed z-50 rounded-lg shadow-xl py-1"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            animation: 'dialogIn 0.1s ease-out',
          }}
        >
          <button
            onClick={() => contextMenu.type === 'node' ? deleteNode(contextMenu.id) : deleteEdge(contextMenu.id)}
            className="flex items-center gap-2 px-3 py-2 text-xs w-full transition-colors"
            style={{ color: 'var(--error)' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <Trash2 size={14} />
            {contextMenu.type === 'node' ? '删除节点' : '删除连接线'}
          </button>
        </div>
      )}

      <style>{`
        @keyframes dialogIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
