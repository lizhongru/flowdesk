import { useEffect, useRef, useState } from 'react';
import { X, Square, ChevronDown, ChevronRight, Loader2, FileText } from 'lucide-react';
import { useExecutionStore } from '../../stores/execution-store';

interface LogPanelProps {
  workflowId: string;
  onClose: () => void;
}

export default function LogPanel({ workflowId, onClose }: LogPanelProps) {
  const {
    activeExecutions, nodeStatuses, nodeOutputs, nodeOutputFiles, nodeErrors, nodeLogs,
    currentExecutionId, executionHistory, cancelExecution,
  } = useExecutionStore();
  const logRef = useRef<HTMLDivElement>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const cancellingRef = useRef(false);

  // 只看当前工作流的执行历史
  const historyList = executionHistory
    .filter(id => activeExecutions[id]?.workflowId === workflowId)
    .reverse();

  // 默认选中最新的（优先当前执行，否则历史最新）
  const defaultId = (currentExecutionId && activeExecutions[currentExecutionId]?.workflowId === workflowId)
    ? currentExecutionId
    : historyList[0] || null;
  const viewId = selectedId || defaultId;

  const currentExecution = viewId ? activeExecutions[viewId] : null;
  const currentNodeStatuses = viewId ? nodeStatuses[viewId] || {} : {};
  const currentNodeOutputs = viewId ? nodeOutputs[viewId] || {} : {};
  const currentNodeOutputFiles = viewId ? nodeOutputFiles[viewId] || {} : {};
  const currentNodeErrors = viewId ? nodeErrors[viewId] || {} : {};
  const currentNodeLogs = viewId ? nodeLogs[viewId] || [] : [];

  // 执行结束时重置取消状态（延迟以显示 loading 效果）
  useEffect(() => {
    if (currentExecution?.status !== 'running' && cancellingRef.current) {
      const timer = setTimeout(() => {
        cancellingRef.current = false;
        setCancelling(false);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [currentExecution?.status]);

  // 新执行开始时重置选择和取消状态
  useEffect(() => {
    setSelectedId(null);
    cancellingRef.current = false;
    setCancelling(false);
  }, [currentExecutionId]);

  // 当有新执行时自动切到最新
  useEffect(() => {
    if (defaultId && !selectedId) {
      setSelectedId(defaultId);
    }
  }, [defaultId, selectedId]);

  // workflowId 变化时重置选择
  useEffect(() => {
    setSelectedId(null);
  }, [workflowId]);

  const statusColors: Record<string, string> = {
    running: 'var(--accent)',
    success: 'var(--success)',
    failed: 'var(--error)',
    skipped: 'var(--text-muted)',
  };

  const statusLabels: Record<string, string> = {
    running: '运行中',
    success: '成功',
    failed: '失败',
    skipped: '跳过',
  };

  const triggerLabels: Record<string, string> = {
    manual: '手动',
    cron: '定时',
    'file-watch': '文件监听',
    hotkey: '快捷键',
  };

  const toggleExpand = (nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const formatOutput = (output: unknown): string => {
    if (output === null || output === undefined) return 'null';
    if (typeof output === 'string') return output;
    try {
      return JSON.stringify(output, null, 2);
    } catch {
      return String(output);
    }
  };

  const formatTime = (iso: string | null): string => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div
      className="h-64 flex flex-col shrink-0"
      style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)' }}
    >
      <div className="flex items-center justify-between px-4 h-8 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
            执行日志
          </span>
          {currentExecution && (
            <>
              <span
                className="text-[10px] px-1.5 py-0.5 rounded"
                style={{
                  background: (statusColors[currentExecution.status] || 'var(--text-muted)') + '20',
                  color: statusColors[currentExecution.status] || 'var(--text-muted)',
                }}
              >
                {statusLabels[currentExecution.status] || currentExecution.status}
              </span>
              <span
                className="text-[10px] px-1.5 py-0.5 rounded"
                style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
              >
                {triggerLabels[currentExecution.triggerType] || currentExecution.triggerType}
              </span>
            </>
          )}
          {historyList.length > 1 && (
            <select
              value={viewId || ''}
              onChange={e => setSelectedId(e.target.value)}
              className="text-[10px] px-1.5 py-0.5 rounded outline-none"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)',
              }}
            >
              {historyList.map((eid, i) => {
                const exec = activeExecutions[eid];
                const label = exec
                  ? `#${historyList.length - i} ${formatTime(exec.startedAt)} ${triggerLabels[exec.triggerType] || ''} ${statusLabels[exec.status] || exec.status}`
                  : eid;
                return <option key={eid} value={eid}>{label}</option>;
              })}
            </select>
          )}
        </div>
        <div className="flex items-center gap-1">
          {(currentExecution?.status === 'running' || cancelling) && (
            <button
              onClick={() => {
                if (viewId && !cancellingRef.current) {
                  cancellingRef.current = true;
                  setCancelling(true);
                  cancelExecution(viewId);
                }
              }}
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 transition-colors"
              title={cancelling ? '正在停止...' : '取消执行'}
              disabled={cancelling}
            >
              {cancelling ? (
                <Loader2 size={10} className="animate-spin" style={{ color: 'var(--error)' }} />
              ) : (
                <Square size={10} style={{ color: 'var(--error)' }} />
              )}
            </button>
          )}
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 transition-colors"
          >
            <X size={12} style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>
      </div>

      <div ref={logRef} className="flex-1 overflow-auto px-4 pb-2">
        {!currentExecution && (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            暂无执行记录
          </p>
        )}

        {Object.entries(currentNodeStatuses).map(([key, status]) => {
          const isExpanded = expandedNodes.has(key);
          const output = currentNodeOutputs[key];
          const error = currentNodeErrors[key];
          const hasDetails = output !== undefined || error;

          // 解析循环迭代：run-command_xxx#0 → nodeId=run-command_xxx, iter=0
          const hashIdx = key.lastIndexOf('#');
          const isIteration = hashIdx > 0 && /\d+$/.test(key);
          const displayId = isIteration ? key.slice(0, hashIdx) : key;
          const iterLabel = isIteration ? ` [${key.slice(hashIdx + 1)}]` : '';

          return (
            <div key={key} className="mb-1">
              <div
                className="flex items-center gap-2 py-0.5 cursor-pointer hover:opacity-80"
                onClick={() => hasDetails && toggleExpand(key)}
              >
                {hasDetails ? (
                  isExpanded
                    ? <ChevronDown size={10} style={{ color: 'var(--text-muted)' }} />
                    : <ChevronRight size={10} style={{ color: 'var(--text-muted)' }} />
                ) : (
                  <span className="w-[10px]" />
                )}
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: statusColors[status as string] || 'var(--text-muted)' }}
                />
                <span className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
                  {displayId}
                </span>
                {iterLabel && (
                  <span className="text-[10px] font-mono" style={{ color: 'var(--accent)' }}>
                    {iterLabel}
                  </span>
                )}
                <span
                  className="text-[10px]"
                  style={{ color: statusColors[status as string] || 'var(--text-muted)' }}
                >
                  {statusLabels[status as string] || status}
                </span>
              </div>

              {isExpanded && (
                <div
                  className="ml-6 mt-0.5 p-2 rounded text-[11px] font-mono whitespace-pre-wrap break-all max-h-32 overflow-auto"
                  style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
                >
                  {error && (
                    <div className="text-red-400">
                      Error: {error}
                    </div>
                  )}
                  {output !== undefined && (
                    <div>{formatOutput(output)}</div>
                  )}
                  {currentNodeOutputFiles[key] && (
                    <button
                      onClick={() => window.api.file.openPath(currentNodeOutputFiles[key])}
                      className="flex items-center gap-1 mt-2 px-2 py-1 rounded text-[10px] transition-colors"
                      style={{ background: 'var(--accent)' + '20', color: 'var(--accent)' }}
                    >
                      <FileText size={10} />
                      查看完整数据
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {currentNodeLogs.length > 0 && (
          <div className="mt-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
            {currentNodeLogs.map((log, i) => (
              <div
                key={i}
                className="text-[11px] font-mono whitespace-pre-wrap break-all py-0.5"
                style={{ color: log.level === 'error' ? 'var(--error)' : 'var(--text-muted)' }}
              >
                {log.message}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
