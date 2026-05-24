import { create } from 'zustand';
import type { Workflow, WorkflowNode, WorkflowEdge } from '../../../shared/types';

interface Snapshot {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

interface WorkflowState {
  workflows: Workflow[];
  currentWorkflow: Workflow | null;
  loading: boolean;
  undoStack: Snapshot[];
  redoStack: Snapshot[];

  fetchWorkflows: () => Promise<void>;
  fetchWorkflow: (id: string) => Promise<void>;
  createWorkflow: () => Promise<Workflow>;
  updateWorkflow: (id: string, data: Partial<Workflow>) => Promise<void>;
  deleteWorkflow: (id: string) => Promise<void>;
  toggleWorkflow: (id: string) => Promise<void>;

  pushSnapshot: () => void;
  updateNodes: (nodes: WorkflowNode[]) => void;
  updateEdges: (edges: WorkflowEdge[]) => void;
  addNode: (node: WorkflowNode) => void;
  removeNode: (nodeId: string) => void;
  undo: () => void;
  redo: () => void;
  saveCanvas: () => Promise<void>;
}

const MAX_UNDO_STEPS = 50;

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  workflows: [],
  currentWorkflow: null,
  loading: true,
  undoStack: [],
  redoStack: [],

  fetchWorkflows: async () => {
    set({ loading: true });
    const workflows = await window.api.workflow.list();
    set({ workflows, loading: false });
  },

  fetchWorkflow: async (id: string) => {
    set({ loading: true });
    try {
      const workflow = await window.api.workflow.get(id);
      set({ currentWorkflow: workflow, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  createWorkflow: async () => {
    const workflow = await window.api.workflow.create({
      name: '未命名工作流',
      nodes: [],
      edges: [],
    });
    set((state) => ({ workflows: [...state.workflows, workflow], currentWorkflow: workflow }));
    return workflow;
  },

  updateWorkflow: async (id, data) => {
    const updated = await window.api.workflow.update(id, data);
    set((state) => ({
      workflows: state.workflows.map(w => w.id === id ? updated : w),
      currentWorkflow: state.currentWorkflow?.id === id ? updated : state.currentWorkflow,
    }));
  },

  deleteWorkflow: async (id) => {
    await window.api.workflow.delete(id);
    set((state) => ({
      workflows: state.workflows.filter(w => w.id !== id),
      currentWorkflow: state.currentWorkflow?.id === id ? null : state.currentWorkflow,
    }));
  },

  toggleWorkflow: async (id) => {
    const updated = await window.api.workflow.toggleEnabled(id);
    set((state) => ({
      workflows: state.workflows.map(w => w.id === id ? updated : w),
      currentWorkflow: state.currentWorkflow?.id === id ? updated : state.currentWorkflow,
    }));
  },

  pushSnapshot: () => {
    const { currentWorkflow, undoStack } = get();
    if (!currentWorkflow) return;
    const snapshot: Snapshot = {
      nodes: currentWorkflow.nodes,
      edges: currentWorkflow.edges,
    };
    const newStack = [...undoStack, snapshot].slice(-MAX_UNDO_STEPS);
    set({ undoStack: newStack, redoStack: [] });
  },

  updateNodes: (nodes) => {
    const { currentWorkflow, undoStack } = get();
    if (!currentWorkflow) return;
    const prev = currentWorkflow.nodes;
    const changed = nodes.length !== prev.length || nodes.some((n, i) => n !== prev[i]);
    set({
      currentWorkflow: { ...currentWorkflow, nodes },
      ...(changed ? {
        undoStack: [...undoStack, { nodes: prev, edges: currentWorkflow.edges }].slice(-MAX_UNDO_STEPS),
        redoStack: [],
      } : {}),
    });
  },

  updateEdges: (edges) => {
    const { currentWorkflow, undoStack } = get();
    if (!currentWorkflow) return;
    const prev = currentWorkflow.edges;
    const changed = edges.length !== prev.length || edges.some((e, i) => e !== prev[i]);
    set({
      currentWorkflow: { ...currentWorkflow, edges },
      ...(changed ? {
        undoStack: [...undoStack, { nodes: currentWorkflow.nodes, edges: prev }].slice(-MAX_UNDO_STEPS),
        redoStack: [],
      } : {}),
    });
  },

  addNode: (node) => {
    set((state) => {
      if (!state.currentWorkflow) return {};
      return {
        currentWorkflow: { ...state.currentWorkflow, nodes: [...state.currentWorkflow.nodes, node] },
        undoStack: [...state.undoStack, { nodes: state.currentWorkflow.nodes, edges: state.currentWorkflow.edges }].slice(-MAX_UNDO_STEPS),
        redoStack: [],
      };
    });
  },

  removeNode: (nodeId) => {
    set((state) => {
      if (!state.currentWorkflow) return {};
      return {
        currentWorkflow: {
          ...state.currentWorkflow,
          nodes: state.currentWorkflow.nodes.filter(n => n.id !== nodeId),
          edges: state.currentWorkflow.edges.filter(
            e => e.source !== nodeId && e.target !== nodeId
          ),
        },
        undoStack: [...state.undoStack, { nodes: state.currentWorkflow.nodes, edges: state.currentWorkflow.edges }].slice(-MAX_UNDO_STEPS),
        redoStack: [],
      };
    });
  },

  undo: () => {
    const { currentWorkflow, undoStack, redoStack } = get();
    if (!currentWorkflow || undoStack.length === 0) return;
    const snapshot = undoStack[undoStack.length - 1];
    const currentSnapshot: Snapshot = {
      nodes: currentWorkflow.nodes,
      edges: currentWorkflow.edges,
    };
    set({
      undoStack: undoStack.slice(0, -1),
      redoStack: [...redoStack, currentSnapshot],
      currentWorkflow: { ...currentWorkflow, nodes: snapshot.nodes, edges: snapshot.edges },
    });
  },

  redo: () => {
    const { currentWorkflow, undoStack, redoStack } = get();
    if (!currentWorkflow || redoStack.length === 0) return;
    const snapshot = redoStack[redoStack.length - 1];
    const currentSnapshot: Snapshot = {
      nodes: currentWorkflow.nodes,
      edges: currentWorkflow.edges,
    };
    set({
      undoStack: [...undoStack, currentSnapshot],
      redoStack: redoStack.slice(0, -1),
      currentWorkflow: { ...currentWorkflow, nodes: snapshot.nodes, edges: snapshot.edges },
    });
  },

  saveCanvas: async () => {
    const { currentWorkflow } = get();
    if (!currentWorkflow) return;
    await window.api.workflow.update(currentWorkflow.id, {
      nodes: currentWorkflow.nodes,
      edges: currentWorkflow.edges,
    });
  },
}));
