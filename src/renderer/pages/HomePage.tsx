import { useEffect, useState, useRef } from 'react';
import { Plus, Trash2, ToggleLeft, ToggleRight, Download, Upload, CheckSquare, Square, MinusSquare, Pencil, Search, ChevronDown, LayoutTemplate, X, Copy } from 'lucide-react';
import { useWorkflowStore } from '../stores/workflow-store';
import { WORKFLOW_CATEGORIES } from '../lib/constants';
import { getNodeDefinition } from '../lib/node-definitions';
import NodeIcon from '../components/NodeIcon';
import ConfirmDialog from '../components/ConfirmDialog';
import type { WorkflowTemplate } from '../../../shared/types';

const TRIGGER_FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'manual', label: '手动触发' },
  { key: 'cron', label: '定时触发' },
  { key: 'file-watch', label: '文件监听' },
  { key: 'hotkey', label: '快捷键' },
] as const;

function getTriggerType(wf: any): string {
  const triggerNode = wf.nodes?.find((n: any) => {
    const def = n.data?.nodeType;
    return ['manual', 'cron', 'file-watch', 'hotkey'].includes(def);
  });
  return triggerNode?.data?.nodeType || 'manual';
}

interface HomePageProps {
  onOpenEditor: (workflowId?: string) => void;
}

export default function HomePage({ onOpenEditor }: HomePageProps) {
  const { workflows, loading, fetchWorkflows, deleteWorkflow, toggleWorkflow, createWorkflow, updateWorkflow } = useWorkflowStore();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [editingDescId, setEditingDescId] = useState<string | null>(null);
  const [descValue, setDescValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState(false);
  const [conflictName, setConflictName] = useState<string | null>(null);
  const [resultDialog, setResultDialog] = useState<{ title: string; count: number; detail: string } | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryDropdownId, setCategoryDropdownId] = useState<string | null>(null);
  const [dropdownUp, setDropdownUp] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);

  useEffect(() => {
    fetchWorkflows();
    window.api.workflow.getTemplates().then(setTemplates);
  }, [fetchWorkflows]);

  useEffect(() => {
    if (!categoryDropdownId) return;
    const close = () => setCategoryDropdownId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [categoryDropdownId]);

  useEffect(() => {
    if (showTemplates && templates.length === 0) {
      window.api.workflow.getTemplates().then(setTemplates);
    }
  }, [showTemplates, templates.length]);

  const handleCreateFromTemplate = async (templateId: string) => {
    const wf = await window.api.workflow.createFromTemplate(templateId);
    setShowTemplates(false);
    await fetchWorkflows();
    onOpenEditor(wf.id);
  };

  const filteredWorkflows = workflows.filter(wf => {
    if (activeFilter !== 'all' && getTriggerType(wf) !== activeFilter) return false;
    if (activeCategory !== 'all' && (wf.category || '其他') !== activeCategory) return false;
    if (searchQuery && !wf.name.toLowerCase().includes(searchQuery.toLowerCase()) && !(wf.description || '').toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const handleDuplicate = async (wf: any) => {
    let name = `${wf.name} (副本)`;
    const existingNames = workflows.map(w => w.name);
    if (existingNames.includes(name)) {
      let i = 1;
      while (existingNames.includes(`${wf.name} (${i} 副本)`)) i++;
      name = `${wf.name} (${i} 副本)`;
    }
    await window.api.workflow.create({
      name,
      description: wf.description || '',
      nodes: wf.nodes,
      edges: wf.edges,
      category: wf.category,
    });
    await fetchWorkflows();
  };

  const handleExport = async (wf: any) => {
    const filePath = await window.api.file.showSaveDialog({
      defaultPath: `${wf.name}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (filePath) {
      await window.api.file.writeJson(filePath, wf);
      setResultDialog({ title: '导出成功', count: 1, detail: filePath });
    }
  };

  const handleBatchExport = async () => {
    const dirPath = await window.api.file.showOpenDialog({
      properties: ['openDirectory'],
    });
    if (!dirPath) return;
    const selected = workflows.filter(wf => selectedIds.has(wf.id));
    for (const wf of selected) {
      const filePath = `${dirPath}/${wf.name}.json`;
      await window.api.file.writeJson(filePath, wf);
    }
    setResultDialog({ title: '导出成功', count: selected.length, detail: dirPath });
    setSelectedIds(new Set());
  };

  const handleImport = async () => {
    const filePaths = await window.api.file.showOpenDialog({
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile', 'multiSelections'],
    });
    if (!filePaths) return;

    const paths = Array.isArray(filePaths) ? filePaths : [filePaths];
    // 刷新最新工作流列表用于名称查重
    await fetchWorkflows();
    const existingNames = new Set(workflows.map(w => w.name));

    let successCount = 0;
    const errors: string[] = [];
    for (const filePath of paths) {
      const fileName = filePath.split(/[/\\]/).pop() || filePath;
      try {
        const data = await window.api.file.readJson(filePath) as any;
        let name = data.name || '导入的工作流';
        if (existingNames.has(name)) {
          let i = 1;
          while (existingNames.has(`${name} (${i})`)) i++;
          name = `${name} (${i})`;
        }
        existingNames.add(name);
        await window.api.workflow.create({
          name,
          description: data.description || '',
          nodes: data.nodes || [],
          edges: data.edges || [],
        });
        successCount++;
      } catch (err: any) {
        errors.push(`${fileName}：${err.message || '格式不正确'}`);
      }
    }
    fetchWorkflows();
    if (errors.length === 0) {
      setResultDialog({ title: '导入成功', count: successCount, detail: `已导入 ${successCount} 个工作流` });
    } else if (successCount === 0) {
      setResultDialog({ title: '导入失败', count: 0, detail: errors.join('\n') });
    } else {
      setResultDialog({ title: '部分导入成功', count: successCount, detail: `成功 ${successCount} 个\n失败 ${errors.length} 个：\n${errors.join('\n')}` });
    }
  };

  const committingRef = useRef(false);

  const commitRename = async (id: string) => {
    if (committingRef.current) return;
    if (!renameValue.trim()) {
      setRenamingId(null);
      return;
    }
    const wf = workflows.find(w => w.id === id);
    if (wf && renameValue.trim() !== wf.name) {
      let name = renameValue.trim();
      const existingNames = workflows.filter(w => w.id !== id).map(w => w.name);
      if (existingNames.includes(name)) {
        let i = 1;
        while (existingNames.includes(`${name} (${i})`)) i++;
        name = `${name} (${i})`;
      }
      committingRef.current = true;
      await updateWorkflow(id, { name });
      committingRef.current = false;
    }
    setRenamingId(null);
  };

  const commitDesc = async (id: string) => {
    const wf = workflows.find(w => w.id === id);
    if (wf && descValue.trim() !== (wf.description || '')) {
      await updateWorkflow(id, { description: descValue.trim() });
    }
    setEditingDescId(null);
  };

  const handleDelete = (id: string, name: string) => {
    setDeleteTarget({ id, name });
  };

  const confirmDelete = async () => {
    if (deleteTarget) {
      await deleteWorkflow(deleteTarget.id);
      setDeleteTarget(null);
    }
  };

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === workflows.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(workflows.map(w => w.id)));
    }
  };

  const confirmBatchDelete = async () => {
    for (const id of selectedIds) {
      await deleteWorkflow(id);
    }
    setSelectedIds(new Set());
    setBatchDeleteConfirm(false);
  };

  const isSelecting = selectedIds.size > 0;
  const allSelected = workflows.length > 0 && selectedIds.size === workflows.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < workflows.length;

  return (
    <div className="h-full overflow-auto p-6" style={{ background: 'var(--bg-primary)' }}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
            我的工作流
          </h1>
          {workflows.length > 0 && (
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors"
              style={{ color: 'var(--text-secondary)' }}
              title={allSelected ? '取消全选' : '全选'}
            >
              {allSelected ? (
                <CheckSquare size={16} style={{ color: 'var(--accent)' }} />
              ) : someSelected ? (
                <MinusSquare size={16} style={{ color: 'var(--accent)' }} />
              ) : (
                <Square size={16} />
              )}
              <span>{allSelected ? '取消全选' : '全选'}</span>
            </button>
          )}
          {isSelecting && (
            <>
              <button
                onClick={handleBatchExport}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{ background: 'var(--accent)' + '20', color: 'var(--accent)' }}
              >
                <Download size={14} />
                导出选中 ({selectedIds.size})
              </button>
              <button
                onClick={() => setBatchDeleteConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{ background: 'var(--error)' + '20', color: 'var(--error)' }}
              >
                <Trash2 size={14} />
                删除选中 ({selectedIds.size})
              </button>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleImport}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
          >
            <Upload size={14} />
            导入
          </button>
          <button
            onClick={() => setShowTemplates(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
          >
            <LayoutTemplate size={14} />
            从模板创建
          </button>
          <button
            onClick={() => onOpenEditor()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            <Plus size={16} />
            新建工作流
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="flex items-center gap-1 overflow-x-auto">
          {TRIGGER_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap"
              style={{
                background: activeFilter === f.key ? 'var(--accent)' + '20' : 'transparent',
                color: activeFilter === f.key ? 'var(--accent)' : 'var(--text-muted)',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="w-px h-4" style={{ background: 'var(--border)' }} />
        <div className="flex items-center gap-1 overflow-x-auto">
          <button
            onClick={() => setActiveCategory('all')}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap"
            style={{
              background: activeCategory === 'all' ? 'var(--accent)' + '20' : 'transparent',
              color: activeCategory === 'all' ? 'var(--accent)' : 'var(--text-muted)',
            }}
          >
            全部分类
          </button>
          {WORKFLOW_CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap"
              style={{
                background: activeCategory === cat ? 'var(--accent)' + '20' : 'transparent',
                color: activeCategory === cat ? 'var(--accent)' : 'var(--text-muted)',
              }}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <div
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
        >
          <Search size={12} style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="搜索工作流..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent outline-none w-32"
            style={{ color: 'var(--text-primary)' }}
          />
        </div>
      </div>

      {loading && (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>加载中...</p>
      )}

      {!loading && workflows.length === 0 && (
        <div className="py-10">
          <p className="text-sm mb-4 text-center" style={{ color: 'var(--text-secondary)' }}>
            还没有工作流，从模板开始快速创建
          </p>
          <div className="grid grid-cols-3 gap-3 max-w-3xl mx-auto">
            {templates.length > 0 ? templates.map(tpl => {
              const def = getNodeDefinition(tpl.nodes[0]?.data.nodeType as string);
              return (
                <button
                  key={tpl.id}
                  onClick={() => handleCreateFromTemplate(tpl.id)}
                  className="flex flex-col items-start p-4 rounded-lg text-left transition-colors hover:brightness-110"
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <NodeIcon name={def?.icon || 'FileText'} size={16} style={{ color: def?.color }} />
                    <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{tpl.name}</span>
                  </div>
                  <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>{tpl.description}</p>
                </button>
              );
            }) : (
              <div className="col-span-3 flex flex-col items-center py-8">
                <button
                  onClick={() => setShowTemplates(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors"
                  style={{ background: 'var(--accent)', color: '#fff' }}
                >
                  <LayoutTemplate size={14} />
                  浏览模板
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-3">
        {filteredWorkflows.map((wf) => (
          <div
            key={wf.id}
            className="group flex items-center justify-between p-4 rounded-lg cursor-pointer transition-colors hover:brightness-110"
            style={{
              background: selectedIds.has(wf.id) ? 'var(--accent)' + '10' : 'var(--bg-surface)',
              border: selectedIds.has(wf.id) ? '1px solid var(--accent)' : '1px solid var(--border)',
              position: 'relative',
              zIndex: categoryDropdownId === wf.id ? 50 : 'auto',
            }}
            onClick={() => onOpenEditor(wf.id)}
          >
            <button
              onClick={(e) => toggleSelect(wf.id, e)}
              className="w-5 h-5 flex items-center justify-center rounded mr-3 shrink-0 transition-colors"
              style={{
                border: selectedIds.has(wf.id) ? '1px solid var(--accent)' : '1px solid var(--border)',
                background: selectedIds.has(wf.id) ? 'var(--accent)' : 'transparent',
              }}
            >
              {selectedIds.has(wf.id) && (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {renamingId === wf.id ? (
                  <input
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value.slice(0, 50))}
                    onBlur={() => commitRename(wf.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename(wf.id);
                      if (e.key === 'Escape') setRenamingId(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    autoFocus
                    maxLength={50}
                    className="font-medium text-sm px-2 py-0.5 rounded outline-none whitespace-nowrap"
                    style={{
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--accent)',
                      color: 'var(--text-primary)',
                      minWidth: '80px',
                      width: `${Math.min(renameValue.length + 2, 30)}em`,
                      maxWidth: '400px',
                    }}
                  />
                ) : (
                  <>
                    <span
                      className="font-medium text-sm"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {wf.name}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setRenameValue(wf.name);
                        setRenamingId(wf.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-white/10"
                      title="重命名"
                    >
                      <Pencil size={12} style={{ color: 'var(--text-muted)' }} />
                    </button>
                  </>
                )}
                <span
                  className="text-xs px-2 py-0.5 rounded"
                  style={{
                    background: wf.enabled ? 'var(--success)' + '20' : 'var(--text-muted)' + '20',
                    color: wf.enabled ? 'var(--success)' : 'var(--text-muted)',
                  }}
                >
                  {wf.enabled ? '已启用' : '已禁用'}
                </span>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded"
                  style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
                >
                  {TRIGGER_FILTERS.find(f => f.key === getTriggerType(wf))?.label || '手动触发'}
                </span>
              </div>
              {editingDescId === wf.id ? (
                <input
                  type="text"
                  value={descValue}
                  onChange={(e) => setDescValue(e.target.value.slice(0, 100))}
                  onBlur={() => commitDesc(wf.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitDesc(wf.id);
                    if (e.key === 'Escape') setEditingDescId(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                  maxLength={100}
                  placeholder="输入描述..."
                  className="text-xs px-1 py-0.5 rounded outline-none w-full whitespace-nowrap"
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--accent)',
                    color: 'var(--text-primary)',
                  }}
                />
              ) : (
                <div className="flex items-center gap-1">
                  <p
                    className="text-xs truncate"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {wf.description || '暂无描述'}
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDescValue(wf.description || '');
                      setEditingDescId(wf.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-white/10 shrink-0"
                    title="编辑描述"
                  >
                    <Pencil size={10} style={{ color: 'var(--text-muted)' }} />
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 ml-4">
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const opening = categoryDropdownId !== wf.id;
                    if (opening) {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setDropdownUp(window.innerHeight - rect.bottom < 160);
                    }
                    setCategoryDropdownId(opening ? wf.id : null);
                  }}
                  className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded transition-colors hover:brightness-125"
                  style={{ background: 'var(--accent)' + '15', color: 'var(--accent)' }}
                >
                  {wf.category || '其他'}
                  <ChevronDown size={10} />
                </button>
                {categoryDropdownId === wf.id && (
                  <div
                    className="absolute right-0 z-50 rounded-lg shadow-xl py-1 min-w-[80px]"
                    style={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border)',
                      ...(dropdownUp ? { bottom: '100%', marginBottom: '4px' } : { top: '100%', marginTop: '4px' }),
                    }}
                  >
                    {WORKFLOW_CATEGORIES.map(cat => (
                      <button
                        key={cat}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (cat !== wf.category) updateWorkflow(wf.id, { category: cat });
                          setCategoryDropdownId(null);
                        }}
                        className="block w-full text-left px-3 py-1.5 text-xs transition-colors"
                        style={{
                          color: cat === wf.category ? 'var(--accent)' : 'var(--text-secondary)',
                          background: cat === wf.category ? 'var(--accent)' + '10' : 'transparent',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = cat === wf.category ? 'var(--accent)' + '10' : 'transparent'}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                已执行 {wf.executionCount} 次
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); handleExport(wf); }}
                className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 transition-colors"
                title="导出"
              >
                <Download size={14} style={{ color: 'var(--text-secondary)' }} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleDuplicate(wf); }}
                className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 transition-colors"
                title="复制"
              >
                <Copy size={14} style={{ color: 'var(--text-secondary)' }} />
              </button>
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  // 启用时检测快捷键冲突
                  if (!wf.enabled) {
                    const conflict = await window.api.workflow.checkHotkeyConflict(wf.id);
                    if (conflict) {
                      setConflictName(conflict);
                      return;
                    }
                  }
                  toggleWorkflow(wf.id);
                }}
                className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 transition-colors"
                title={wf.enabled ? '禁用' : '启用'}
              >
                {wf.enabled ? (
                  <ToggleRight size={16} style={{ color: 'var(--success)' }} />
                ) : (
                  <ToggleLeft size={16} style={{ color: 'var(--text-muted)' }} />
                )}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(wf.id, wf.name); }}
                className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 transition-colors"
                title="删除"
              >
                <Trash2 size={14} style={{ color: 'var(--error)' }} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="删除工作流"
        message={`确定要删除「${deleteTarget?.name}」吗？此操作不可撤销。`}
        confirmText="删除"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={batchDeleteConfirm}
        title="批量删除工作流"
        message={`确定要删除选中的 ${selectedIds.size} 个工作流吗？此操作不可撤销。`}
        confirmText={`删除 ${selectedIds.size} 个`}
        danger
        onConfirm={confirmBatchDelete}
        onCancel={() => setBatchDeleteConfirm(false)}
      />

      <ConfirmDialog
        open={!!conflictName}
        title="快捷键冲突"
        message={`与工作流「${conflictName}」快捷键重复，请修改快捷键后再启用。`}
        onCancel={() => setConflictName(null)}
      />

      <ConfirmDialog
        open={!!resultDialog}
        title={resultDialog?.title || ''}
        message={`${resultDialog?.detail}`}
        onCancel={() => setResultDialog(null)}
      />

      {/* 模板选择弹窗 */}
      {showTemplates && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={() => setShowTemplates(false)}
        >
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)' }} />
          <div
            className="relative w-[540px] max-h-[80vh] overflow-auto rounded-xl shadow-2xl p-5"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>选择模板</h3>
              <button
                onClick={() => setShowTemplates(false)}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 transition-colors"
              >
                <X size={14} style={{ color: 'var(--text-muted)' }} />
              </button>
            </div>
            <div className="grid gap-3">
              {templates.map(tpl => {
                const firstDef = getNodeDefinition(tpl.nodes[0]?.data.nodeType as string);
                return (
                  <button
                    key={tpl.id}
                    onClick={() => handleCreateFromTemplate(tpl.id)}
                    className="flex items-start gap-3 p-4 rounded-lg text-left transition-colors hover:brightness-110"
                    style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}
                  >
                    <span className="mt-0.5"><NodeIcon name={firstDef?.icon || 'FileText'} size={18} style={{ color: firstDef?.color }} /></span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium mb-1" style={{ color: 'var(--text-primary)' }}>{tpl.name}</div>
                      <div className="text-[11px] mb-1.5" style={{ color: 'var(--text-muted)' }}>{tpl.description}</div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--accent)' + '15', color: 'var(--accent)' }}>
                          {tpl.category}
                        </span>
                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                          {tpl.nodes.length} 个节点
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
