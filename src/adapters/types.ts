import { GitDiffResult } from '../git.js';

export type AgentId = 'auto' | 'agy' | 'claude' | 'codex' | 'cursor';

export interface AgentOptionsBag {
  claude?: {
    effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
    compact?: boolean;
    appendSystemPrompt?: string;
    customFlags?: string[];
  };
  agy?: {
    effort?: 'low' | 'high';
    sandbox?: boolean;
    addDirs?: string[];
    rules?: string[];
    skills?: string[];
  };
  cursor?: {
    customRulesPath?: string;
  };
  codex?: {
    fullAuto?: boolean;
  };
  [key: string]: any;
}

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
  isolateWorktree?: boolean;
  agentOptions?: AgentOptionsBag;
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
  worktreePath?: string;
  worktreeBranch?: string;
}

export interface AgentCapabilities {
  modes: ('edit' | 'plan' | 'explain')[];
  supportsThinking: boolean;
  thinkingLevels: string[];
  supportsWorktreeIsolation: boolean;
  supportsSandbox: boolean;
  supportsAddDirs: boolean;
  supportsMultiTurn: boolean;
  supportsCustomSkills: boolean;
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
  capabilities?: AgentCapabilities;
  notes?: string;
}

export interface BaseAgentAdapter {
  readonly id: AgentId;
  readonly name: string;
  isAvailable(): Promise<boolean>;
  getStatus(): Promise<AgentStatus>;
  execute(options: AgentTaskOptions): Promise<AgentTaskResult>;
}
