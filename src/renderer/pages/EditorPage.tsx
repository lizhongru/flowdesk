import { useEffect, useState, useCallback, useRef } from 'react';
import { ArrowLeft, Play, Square, ScrollText, Loader2, Bell, BellOff } from 'lucide-react';
import FlowCanvas from '../components/Canvas/FlowCanvas';
import NodePanel from '../components/NodePanel/NodePanel';
import PropertiesPanel from '../components/Properties/PropertiesPanel';
import LogPanel from '../components/ExecutionLog/LogPanel';
import ConfirmDialog from '../components/ConfirmDialog';
import { useWorkflowStore } from '../stores/workflow-store';
import { useExecutionStore } from '../stores/execution-store';
import type { WorkflowNode, WorkflowEdge, ExecutionEvent } from '../../../shared/types';

interface EditorPageProps {
  workflowId?: string;
  onBack: () => void;
}

export default function EditorPage({ workflowId, onBack }: EditorPageProps) {
  const { currentWorkflow, loading, fetchWorkflow, createWorkflow, updateWorkflow, updateNodes, updateEdges, saveCanvas, undo, redo, undoStack, redoStack } = useWorkflowStore();
  const { startExecution, cancelExecution, handleEvents, currentExecutionId, activeExecutions, executionHistory } = useExecutionStore();
  const workflowExecCount = currentWorkflow
    ? executionHistory.filter(id => activeExecutions[id]?.workflowId === currentWorkflow.id).length
    : 0;
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const createdRef = useRef(false);
  const [cancelling, setCancelling] = useState(false);
  const cancellingRef = useRef(false);
  const [conflictName, setConflictName] = useState<string | null>(null);

  useEffect(() => {
    if (workflowId) {
      fetchWorkflow(workflowId);
    } else if (!createdRef.current) {
      createdRef.current = true;
      createWorkflow();
    }
    // 离开编辑器时：先立即保存未持久化的更改，再清空当前工作流
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      // 同步保存：直接用当前 store 状态写入数据库
      const wf = useWorkflowStore.getState().currentWorkflow;
      if (wf) {
        window.api.workflow.update(wf.id, { nodes: wf.nodes, edges: wf.edges });
      }
      useWorkflowStore.setState({ currentWorkflow: null });
    };
  }, [workflowId, fetchWorkflow, createWorkflow]);

  useEffect(() => {
    const unsubscribe = window.api.onExecutionEvents((events: ExecutionEvent[]) => {
      handleEvents(events);
    });
    return unsubscribe;
  }, [handleEvents]);

  // Undo/Redo keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (undoStack.length > 0) {
          if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
          undo();
          saveCanvas();
        }
      } else if (mod && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        if (redoStack.length > 0) {
          if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
          redo();
          saveCanvas();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, undoStack, redoStack, saveCanvas]);

  const debouncedSave = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = setTimeout(() => {
      saveCanvas();
    }, 2000);
  }, [saveCanvas]);

  const handleNodesChange = useCallback((nodes: WorkflowNode[]) => {
    // 合并 FlowCanvas 的位置信息和 store 中的节点数据（属性面板可能已更新）
    const storeNodes = useWorkflowStore.getState().currentWorkflow?.nodes;
    if (storeNodes) {
      const storeMap = new Map(storeNodes.map(n => [n.id, n]));
      let changed = nodes.length !== storeNodes.length;
      const merged = nodes.map(n => {
        const storeNode = storeMap.get(n.id);
        if (storeNode && storeNode !== n) {
          // 只在位置或数据实际变化时创建新对象
          const posChanged = storeNode.position.x !== n.position.x || storeNode.position.y !== n.position.y;
          const dataChanged = storeNode.data !== n.data;
          if (posChanged || dataChanged) {
            changed = true;
            return { ...storeNode, position: n.position };
          }
          return storeNode;
        }
        return n;
      });
      if (changed) updateNodes(merged);
    } else {
      updateNodes(nodes);
    }
    debouncedSave();
  }, [updateNodes, debouncedSave]);

  const handleEdgesChange = useCallback((edges: WorkflowEdge[]) => {
    updateEdges(edges);
    debouncedSave();
  }, [updateEdges, debouncedSave]);

  const handleNodeSelect = useCallback((nodeId: string | null) => {
    setSelectedNodeId(nodeId);
  }, []);

  const handleUpdateNode = useCallback((nodeId: string, data: Record<string, unknown>) => {
    if (!currentWorkflow) return;
    const newNodes = currentWorkflow.nodes.map((n) =>
      n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
    );
    updateNodes(newNodes);
    debouncedSave();
  }, [currentWorkflow, updateNodes, debouncedSave]);

  const handleRun = async () => {
    if (!currentWorkflow) return;
    // Flush pending debounced save before executing
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    await saveCanvas();

    // 检测快捷键冲突
    const conflict = await window.api.workflow.checkHotkeyConflict(currentWorkflow.id);
    if (conflict) {
      setConflictName(conflict);
      return;
    }

    setShowLog(true);
    await startExecution(currentWorkflow.id);
  };

  const isRunning = currentExecutionId && activeExecutions[currentExecutionId]?.status === 'running';

  const handleCancel = () => {
    if (currentExecutionId && !cancellingRef.current) {
      cancellingRef.current = true;
      setCancelling(true);
      cancelExecution(currentExecutionId);
    }
  };

  // 执行结束时重置取消状态
  useEffect(() => {
    if (!isRunning && cancellingRef.current) {
      const timer = setTimeout(() => {
        cancellingRef.current = false;
        setCancelling(false);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [isRunning]);

  const startRename = () => {
    if (!currentWorkflow) return;
    setNameValue(currentWorkflow.name);
    setEditingName(true);
  };

  const commitRename = async () => {
    if (!currentWorkflow || !nameValue.trim()) {
      setEditingName(false);
      return;
    }
    if (nameValue.trim() !== currentWorkflow.name) {
      let name = nameValue.trim();
      const allWorkflows = await window.api.workflow.list();
      const existingNames = allWorkflows.filter(w => w.id !== currentWorkflow.id).map(w => w.name);
      if (existingNames.includes(name)) {
        let i = 1;
        while (existingNames.includes(`${name} (${i})`)) i++;
        name = `${name} (${i})`;
      }
      await window.api.workflow.update(currentWorkflow.id, { name });
      await fetchWorkflow(currentWorkflow.id);
    }
    setEditingName(false);
  };

  const selectedNode = currentWorkflow?.nodes.find((n) => n.id === selectedNodeId) || null;

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--bg-primary)' }}>
      <div
        className="flex items-center gap-3 px-4 h-10 shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs transition-colors"
          style={{ color: 'var(--text-secondary)' }}
        >
          <ArrowLeft size={14} />
          返回
        </button>
        {editingName ? (
          <input
            type="text"
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value.slice(0, 50))}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') setEditingName(false);
            }}
            autoFocus
            maxLength={50}
            className="text-sm font-medium px-2 py-0.5 rounded outline-none whitespace-nowrap"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--accent)',
              color: 'var(--text-primary)',
              minWidth: '80px',
              width: `${Math.min(nameValue.length + 2, 30)}em`,
              maxWidth: '400px',
            }}
          />
        ) : (
          <span
            className="text-sm font-medium cursor-pointer hover:opacity-80"
            style={{ color: 'var(--text-primary)' }}
            onDoubleClick={startRename}
            title="双击重命名"
          >
            {currentWorkflow?.name || '新建工作流'}
          </span>
        )}
        <div className="flex-1" />
        <button
          onClick={() => {
            if (!currentWorkflow) return;
            updateWorkflow(currentWorkflow.id, { notifyOnComplete: !currentWorkflow.notifyOnComplete });
          }}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs transition-colors"
          style={{
            color: currentWorkflow?.notifyOnComplete ? 'var(--accent)' : 'var(--text-muted)',
          }}
          title={currentWorkflow?.notifyOnComplete ? '关闭完成通知' : '开启完成通知'}
        >
          {currentWorkflow?.notifyOnComplete ? <Bell size={14} /> : <BellOff size={14} />}
        </button>
        <button
          onClick={() => setShowLog(v => !v)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
          style={{
            background: showLog ? 'var(--accent)' + '20' : 'transparent',
            color: showLog ? 'var(--accent)' : 'var(--text-secondary)',
            border: showLog ? 'none' : '1px solid transparent',
          }}
        >
          <ScrollText size={12} />
          日志
          {workflowExecCount > 0 && (
            <span
              className="text-[10px] px-1 rounded-full"
              style={{ background: 'var(--accent)' + '30', color: 'var(--accent)' }}
            >
              {workflowExecCount}
            </span>
          )}
        </button>
        {(isRunning || cancelling) ? (
          <button
            onClick={handleCancel}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{ background: 'var(--error)' + '20', color: 'var(--error)' }}
            disabled={cancelling}
          >
            {cancelling ? <Loader2 size={12} className="animate-spin" /> : <Square size={12} />}
            {cancelling ? '停止中...' : '停止'}
          </button>
        ) : (
          <button
            onClick={handleRun}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{ background: 'var(--success)' + '20', color: 'var(--success)' }}
          >
            <Play size={12} />
            运行
          </button>
        )}
      </div>
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden">
            {loading && !currentWorkflow ? (
              <div className="w-full h-full flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
                <Loader2 size={24} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
              </div>
            ) : (
              <FlowCanvas
                nodes={currentWorkflow?.nodes || []}
                edges={currentWorkflow?.edges || []}
                onNodesChange={handleNodesChange}
                onEdgesChange={handleEdgesChange}
                onNodeSelect={handleNodeSelect}
              />
            )}
          </div>
          {showLog && currentWorkflow && <LogPanel workflowId={currentWorkflow.id} onClose={() => setShowLog(false)} />}
        </div>
        {selectedNode ? (
          <PropertiesPanel
            node={selectedNode}
            allNodes={currentWorkflow?.nodes || []}
            currentWorkflowId={currentWorkflow?.id}
            onUpdateNode={handleUpdateNode}
            onClose={() => setSelectedNodeId(null)}
          />
        ) : (
          <NodePanel />
        )}
      </div>

      <ConfirmDialog
        open={!!conflictName}
        title="快捷键冲突"
        message={`与工作流「${conflictName}」快捷键重复，请修改快捷键后再运行。`}
        onCancel={() => setConflictName(null)}
      />
    </div>
  );
}
