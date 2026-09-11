export type AgyMode = 'edit' | 'plan' | 'explain' | 'accept-edits';

export type AgyEffort = 'low' | 'medium' | 'high';

export type AgyTier = 'fast' | 'standard' | 'deep';

export interface AgyRunOptions {
  /** The prompt or instruction for Antigravity */
  prompt: string;
  /** Working directory (defaults to current process cwd) */
  workspaceDir?: string;
  /** Resume an existing conversation by ID */
  conversationId?: string;
  /** Execution mode: 'edit' (default), 'plan', or 'explain' */
  mode?: AgyMode;
  /** Reasoning effort: low, medium, high */
  effort?: AgyEffort;
  /** Intelligence tier: 'fast' | 'standard' | 'deep' */
  tier?: AgyTier;
  /** Explicit model override (takes precedence over tier) */
  model?: string;
  /** Auto-approve tool permissions without prompting (defaults to true) */
  dangerouslySkipPermissions?: boolean;
  /** Execution timeout in seconds (default: 600s / 10min) */
  timeoutSeconds?: number;
  /** Additional directories to mount into the workspace */
  addDirs?: string[];
  /** Run in sandbox mode */
  sandbox?: boolean;
  /** Arbitrary CLI flags to pass directly to the agy binary */
  rawArgs?: string[];
  /** Whether to capture and include a git diff of working directory changes */
  includeDiff?: boolean;
  /** Whether this is a stateless one-off call (does not persist in session registry) */
  oneOff?: boolean;
}

export interface AgyUsage {
  input_tokens?: number;
  output_tokens?: number;
  thinking_tokens?: number;
  cache_read_tokens?: number;
  total_tokens?: number;
}

export interface AgyStepToolInfo {
  name: string;
  parameters?: Record<string, unknown>;
  output?: string;
}

export interface AgyStepSummary {
  stepIndex: number;
  stepType: 'user_input' | 'agent_response' | 'tool' | string;
  state: 'ACTIVE' | 'DONE' | 'ERROR' | string;
  toolName?: string;
  toolParameters?: Record<string, unknown>;
  toolOutput?: string;
  durationSeconds?: number;
}

export interface AgyExecutionResult {
  conversationId: string;
  status: 'SUCCESS' | 'ERROR';
  response: string;
  error?: string;
  durationSeconds: number;
  numTurns: number;
  usage?: AgyUsage;
  steps: AgyStepSummary[];
  rawResult?: Record<string, unknown>;
  gitDiff?: string;
  modifiedFiles?: string[];
  isOneOff?: boolean;
}

export interface AgyModelInfo {
  id: string;
  name: string;
  description?: string;
  recommendedTier?: AgyTier;
}

export interface AgySessionInfo {
  id: string;
  title: string;
  createdAt: string;
  lastActiveAt: string;
  turns: number;
  workspaceDir: string;
  totalTokens: number;
}
