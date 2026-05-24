import { create } from 'zustand';
import type { ExecutionEvent, ExecutionLog } from '../../../shared/types';

export interface NodeLogEntry {
  nodeId: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  timestamp: number;
}

interface ExecutionState {
  activeExecutions: Record<string, ExecutionLog>;
  nodeStatuses: Record<string, Record<string, string>>;
  nodeOutputs: Record<string, Record<string, unknown>>;
  nodeOutputFiles: Record<string, Record<string, string>>;
  nodeErrors: Record<string, Record<string, string>>;
  nodeLogs: Record<string, NodeLogEntry[]>;
  currentExecutionId: string | null;
  executionHistory: string[];

  startExecution: (workflowId: string) => Promise<void>;
  cancelExecution: (executionId: string) => Promise<void>;
  handleEvents: (events: ExecutionEvent[]) => void;
  clearExecution: (executionId: string) => void;
}

export const useExecutionStore = create<ExecutionState>((set, get) => ({
  activeExecutions: {},
  nodeStatuses: {},
  nodeOutputs: {},
  nodeOutputFiles: {},
  nodeErrors: {},
  nodeLogs: {},
  currentExecutionId: null,
  executionHistory: [],

  startExecution: async (workflowId) => {
    const log = await window.api.execution.run(workflowId);
    set((state) => ({
      activeExecutions: { ...state.activeExecutions, [log.id]: log },
    }));
  },

  cancelExecution: async (executionId) => {
    await window.api.execution.cancel(executionId);
  },

  handleEvents: (events) => {
    set((state) => {
      let newCurrentId = state.currentExecutionId;
      let newHistory = state.executionHistory;
      const newActive = { ...state.activeExecutions };
      const newStatuses = { ...state.nodeStatuses };
      const newOutputs = { ...state.nodeOutputs };
      const newOutputFiles = { ...state.nodeOutputFiles };
      const newErrors = { ...state.nodeErrors };
      const newLogs = { ...state.nodeLogs };

      for (const event of events) {
        const execId = event.executionId;

        if (event.type === 'started') {
          newCurrentId = execId;
          newHistory = [...newHistory, execId];
          newActive[execId] = {
            id: execId,
            workflowId: event.workflowId,
            status: 'running',
            triggerType: event.triggerType || 'manual',
            startedAt: new Date().toISOString(),
            finishedAt: null,
            nodeLogs: [],
          };
          newStatuses[execId] = {};
          newOutputs[execId] = {};
          newErrors[execId] = {};
          newLogs[execId] = [];
          continue;
        }

        if (event.type === 'complete') {
          const log = newActive[execId];
          if (log) {
            newActive[execId] = { ...log, status: event.status, finishedAt: new Date().toISOString() };
          }
          continue;
        }

        if (event.type === 'node-status') {
          const key = event.instanceId || event.nodeId;
          newStatuses[execId] = { ...(newStatuses[execId] || {}), [key]: event.status };
          continue;
        }

        if (event.type === 'node-output') {
          const key = event.instanceId || event.nodeId;
          newOutputs[execId] = { ...(newOutputs[execId] || {}), [key]: event.output };
          if (event.outputFile) {
            newOutputFiles[execId] = { ...(newOutputFiles[execId] || {}), [key]: event.outputFile };
          }
          continue;
        }

        if (event.type === 'node-error') {
          const key = event.instanceId || event.nodeId;
          newErrors[execId] = { ...(newErrors[execId] || {}), [key]: event.error };
          continue;
        }

        if (event.type === 'log') {
          newLogs[execId] = [...(newLogs[execId] || []), {
            nodeId: event.nodeId,
            level: event.level,
            message: event.message,
            timestamp: Date.now(),
          }];
          continue;
        }
      }

      return {
        currentExecutionId: newCurrentId,
        executionHistory: newHistory,
        activeExecutions: newActive,
        nodeStatuses: newStatuses,
        nodeOutputs: newOutputs,
        nodeOutputFiles: newOutputFiles,
        nodeErrors: newErrors,
        nodeLogs: newLogs,
      };
    });
  },

  clearExecution: (executionId) => {
    set((state) => {
      const { [executionId]: _, ...rest } = state.activeExecutions;
      const { [executionId]: __, ...restStatuses } = state.nodeStatuses;
      const { [executionId]: ___, ...restOutputs } = state.nodeOutputs;
      const { [executionId]: ____, ...restOutputFiles } = state.nodeOutputFiles;
      const { [executionId]: _____, ...restErrors } = state.nodeErrors;
      const { [executionId]: ______, ...restLogs } = state.nodeLogs;
      return {
        activeExecutions: rest,
        nodeStatuses: restStatuses,
        nodeOutputs: restOutputs,
        nodeOutputFiles: restOutputFiles,
        nodeErrors: restErrors,
        nodeLogs: restLogs,
        executionHistory: state.executionHistory.filter(id => id !== executionId),
        currentExecutionId: state.currentExecutionId === executionId ? null : state.currentExecutionId,
      };
    });
  },
}));
