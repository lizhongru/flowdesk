import { useEffect, useState, useCallback } from 'react';
import { ChevronDown, ChevronRight, Clock, Loader2, Copy, Check } from 'lucide-react';
import type { ExecutionHistoryEntry, ExecutionLog, NodeExecutionLog } from '../../../shared/types';

const STATUS_TABS = [
  { key: 'all', label: '全部' },
  { key: 'success', label: '成功' },
  { key: 'failed', label: '失败' },
  { key: 'cancelled', label: '已取消' },
] as const;

const statusColors: Record<string, string> = {
  running: 'var(--accent)',
  success: 'var(--success)',
  failed: 'var(--error)',
  cancelled: 'var(--text-muted)',
  skipped: 'var(--text-muted)',
};

const statusLabels: Record<string, string> = {
  running: '运行中',
  success: '成功',
  failed: '失败',
  cancelled: '已取消',
  skipped: '跳过',
};

const triggerLabels: Record<string, string> = {
  manual: '手动',
  cron: '定时',
  'file-watch': '文件监听',
  hotkey: '快捷键',
  workflow: '工作流调用',
};

function formatDuration(ms: number | null): string {
  if (ms === null) return '-';
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rem = (s % 60).toFixed(0);
  return `${m}m ${rem}s`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const PAGE_SIZE = 20;

export default function HistoryPage() {
  const [items, setItems] = useState<ExecutionHistoryEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ExecutionLog | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await window.api.execution.getHistory({
        status: statusFilter === 'all' ? undefined : statusFilter,
        offset: page * PAGE_SIZE,
        limit: PAGE_SIZE,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch {
      // ignore
    }
    setLoading(false);
  }, [statusFilter, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(id);
    setDetailLoading(true);
    try {
      const log = await window.api.execution.getLogDetail(id);
      setDetail(log || null);
    } catch {
      setDetail(null);
    }
    setDetailLoading(false);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      {/* 顶部筛选 */}
      <div className="flex items-center gap-3 px-5 py-3 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>执行历史</h2>
        <div className="flex-1" />
        <div className="flex gap-1">
          {STATUS_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => { setStatusFilter(tab.key); setPage(0); }}
              className="px-2.5 py-1 rounded-md text-xs font-medium transition-colors"
              style={{
                background: statusFilter === tab.key ? 'var(--accent)' + '20' : 'transparent',
                color: statusFilter === tab.key ? 'var(--accent)' : 'var(--text-muted)',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 表格 */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 size={20} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
          </div>
        ) : items.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>暂无执行记录</span>
          </div>
        ) : (
          <div className="px-5 py-3">
            {/* 表头 */}
            <div
              className="grid items-center px-3 py-2 rounded-t-lg text-[11px] font-medium"
              style={{
                gridTemplateColumns: '1fr 80px 80px 80px 150px 36px',
                background: 'var(--bg-elevated)',
                color: 'var(--text-muted)',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <span>工作流</span>
              <span>触发</span>
              <span>状态</span>
              <span>耗时</span>
              <span>时间</span>
              <span />
            </div>

            {/* 行 */}
            {items.map((item, idx) => (
              <div key={item.id}>
                <button
                  onClick={() => handleExpand(item.id)}
                  className="w-full grid items-center px-3 py-2.5 text-xs transition-colors text-left"
                  style={{
                    gridTemplateColumns: '1fr 80px 80px 80px 150px 36px',
                    background: idx % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-primary)',
                    borderBottom: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                  onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-primary)'}
                >
                  <span className="truncate pr-2">{item.workflowName}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{triggerLabels[item.triggerType] || item.triggerType}</span>
                  <span>
                    <span
                      className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium"
                      style={{
                        background: (statusColors[item.status] || 'var(--text-muted)') + '20',
                        color: statusColors[item.status] || 'var(--text-muted)',
                      }}
                    >
                      {statusLabels[item.status] || item.status}
                    </span>
                  </span>
                  <span style={{ color: 'var(--text-secondary)' }}>{formatDuration(item.duration)}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{formatTime(item.startedAt)}</span>
                  <span className="flex justify-center" style={{ color: 'var(--text-muted)' }}>
                    {expandedId === item.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </span>
                </button>

                {/* 展开详情 */}
                {expandedId === item.id && (
                  <div
                    className="px-4 py-3"
                    style={{
                      background: 'var(--bg-elevated)',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    {detailLoading ? (
                      <div className="flex items-center gap-2 py-2">
                        <Loader2 size={14} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
                        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>加载中...</span>
                      </div>
                    ) : detail ? (
                      <div className="flex gap-2">
                        <div className="shrink-0 pt-0.5">
                          <CopyDetailButton detail={detail} item={item} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <NodeDetails nodes={detail.nodeLogs} />
                        </div>
                      </div>
                    ) : (
                      <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>无详情</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div
          className="flex items-center justify-between px-5 py-2 shrink-0"
          style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)' }}
        >
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            共 {total} 条记录
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
              className="px-2 py-1 rounded text-xs transition-colors disabled:opacity-40"
              style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
            >
              上一页
            </button>
            <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
              {page + 1} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => setPage(p => p + 1)}
              className="px-2 py-1 rounded text-xs transition-colors disabled:opacity-40"
              style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
            >
              下一页
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CopyDetailButton({ detail, item }: { detail: ExecutionLog; item: ExecutionHistoryEntry }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const lines: string[] = [];
    lines.push(`工作流: ${item.workflowName}`);
    lines.push(`状态: ${statusLabels[item.status] || item.status}  触发: ${triggerLabels[item.triggerType] || item.triggerType}  耗时: ${formatDuration(item.duration)}`);
    lines.push(`时间: ${formatTime(item.startedAt)}`);
    lines.push('');
    if (detail.nodeLogs?.length) {
      for (const node of detail.nodeLogs) {
        const dur = node.duration != null ? formatDuration(node.duration) : '-';
        lines.push(`[${statusLabels[node.status] || node.status}] ${node.nodeType} (${node.nodeId}) ${dur}`);
        if (node.error) lines.push(`  错误: ${node.error}`);
        if (node.output != null) lines.push(`  输出: ${typeof node.output === 'string' ? node.output : JSON.stringify(node.output, null, 2)}`);
        if (node.input != null) lines.push(`  输入: ${typeof node.input === 'string' ? node.input : JSON.stringify(node.input, null, 2)}`);
      }
    }
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  return (
    <button
      onClick={copy}
      className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 transition-colors"
      title="复制日志"
    >
      {copied ? (
        <Check size={12} style={{ color: 'var(--success)' }} />
      ) : (
        <Copy size={12} style={{ color: 'var(--text-muted)' }} />
      )}
    </button>
  );
}

function NodeDetails({ nodes }: { nodes: NodeExecutionLog[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (!nodes || nodes.length === 0) {
    return <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>无节点日志</span>;
  }

  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-1">
      {nodes.map((node, i) => {
        const key = `${node.nodeId}-${i}`;
        const isOpen = expanded.has(key);
        const dur = node.duration != null ? formatDuration(node.duration) : '-';

        return (
          <div key={key}>
            <button
              onClick={() => toggle(key)}
              className="flex items-center gap-2 w-full py-1 text-left transition-colors"
              style={{ color: 'var(--text-primary)' }}
            >
              <span style={{ color: 'var(--text-muted)' }}>
                {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </span>
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: statusColors[node.status] || 'var(--text-muted)' }}
              />
              <span className="text-[11px] font-medium truncate">{node.nodeType}</span>
              <span className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{node.nodeId}</span>
              <span className="flex-1" />
              <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                {statusLabels[node.status] || node.status}
              </span>
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{dur}</span>
            </button>
            {isOpen && (
              <div className="ml-6 mb-1 p-2 rounded text-[11px] font-mono whitespace-pre-wrap break-all" style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                {node.error && <div style={{ color: 'var(--error)' }}>错误: {node.error}</div>}
                {node.output != null && <div>输出: {typeof node.output === 'string' ? node.output : JSON.stringify(node.output, null, 2)}</div>}
                {node.input != null && <div>输入: {typeof node.input === 'string' ? node.input : JSON.stringify(node.input, null, 2)}</div>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
