import { GitDiffResult } from '../git.js';

export type AgentId = 'auto' | 'agy' | 'claude' | 'codex' | 'cursor';

export interface AgentTaskOptions {
  agent?: AgentId;
  prompt: string;
  workspaceDir?: string;
  sessionId?: string;
  mode?: 'edit' | 'plan' | 'explain';
  model?: string;
  thinking?: string;
  oneOff?: boolean;
  includeDiff?: boolean;
  timeoutSeconds?: number;
  addDirs?: string[];
  dangerouslySkipPermissions?: boolean;
}

export interface AgentTokens {
  total?: number;
  input?: number;
  output?: number;
  thinking?: number;
  cache?: number;
}

export interface AgentToolUse {
  name: string;
  target?: string;
  status: 'DONE' | 'ERROR';
}

export interface AgentTaskResult {
  success: boolean;
  agent: string;
  output: string;
  error?: string;
  sessionId?: string;
  sessionAlias?: string;
  durationMs: number;
  turns?: number;
  tokens?: AgentTokens;
  costUsd?: number;
  toolsUsed?: AgentToolUse[];
  diff?: GitDiffResult;
  modelUsed?: string;
  isOneOff?: boolean;
}

export interface AgentStatus {
  id: AgentId;
  name: string;
  installed: boolean;
  binaryPath?: string;
  version?: string;
  authenticated?: boolean;
  models: string[];
  defaultModel: string;
  thinkingLevels: string[];
  notes?: string;
}

export interface BaseAgentAdapter {
  readonly id: AgentId;
  readonly name: string;
  isAvailable(): Promise<boolean>;
  getStatus(): Promise<AgentStatus>;
  execute(options: AgentTaskOptions): Promise<AgentTaskResult>;
}
