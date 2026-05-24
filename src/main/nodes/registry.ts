import type { ExecutionContext } from '../../../shared/types';

export type NodeHandler = (
  data: Record<string, unknown>,
  input: unknown,
  context: ExecutionContext
) => Promise<unknown>;

export const nodeRegistry = new Map<string, NodeHandler>();
