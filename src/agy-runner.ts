import { spawn, execSync, ChildProcess } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as readline from 'node:readline';
import {
  AgyExecutionResult,
  AgyModelInfo,
  AgyRunOptions,
  AgySessionInfo,
  AgyStepSummary,
  AgyTier,
  AgyUsage,
} from './types.js';

let cachedAgyPath: string | null = null;

// Track active child processes for bulletproof cleanup/reaping
const activeChildProcesses = new Set<ChildProcess>();

// In-memory session registry
const sessionRegistry = new Map<string, AgySessionInfo>();

// Friendly aliases (e.g. "worker-auth" -> UUID)
const aliasToSessionIdMap = new Map<string, string>();
const sessionIdToAliasMap = new Map<string, string>();

// Connection-scoped active session ID (auto-threaded when caller omits session_id)
let currentActiveSessionId: string | null = null;

/**
 * Returns the currently active connection-scoped session ID.
 */
export function getActiveSessionId(): string | null {
  return currentActiveSessionId;
}

/**
 * Sets or switches the active connection-scoped session ID.
 */
export function setActiveSessionId(id: string | null): void {
  currentActiveSessionId = id;
}

/**
 * Resets the active session on this connection to start fresh.
 */
export function resetActiveSession(): void {
  currentActiveSessionId = null;
}

/**
 * Resolves a session ID, looking up any friendly alias if present.
 */
export function resolveSessionId(aliasOrId?: string): string | undefined {
  if (!aliasOrId) return undefined;
  return aliasToSessionIdMap.get(aliasOrId) || aliasOrId;
}

/**
 * Registers a friendly alias for a conversation UUID.
 */
export function registerSessionAlias(alias: string, sessionId: string): void {
  aliasToSessionIdMap.set(alias, sessionId);
  sessionIdToAliasMap.set(sessionId, alias);
}

/**
 * Gets the friendly alias for a conversation UUID, if registered.
 */
export function getSessionAlias(sessionId: string): string | undefined {
  return sessionIdToAliasMap.get(sessionId);
}

/**
 * Reaps all running child processes immediately.
 * Called on parent process termination, stdin close, or shutdown signals.
 */
export function reapAllChildren(reason: string): void {
  if (activeChildProcesses.size === 0) return;

  process.stderr.write(
    `[agy-mcp] Reaping ${activeChildProcesses.size} active child process(es) (${reason})...\n`
  );

  for (const proc of activeChildProcesses) {
    try {
      if (!proc.killed) {
        proc.kill('SIGTERM');
        // Forceful kill fallback
        setTimeout(() => {
          try {
            if (!proc.killed) proc.kill('SIGKILL');
          } catch {}
        }, 1000).unref();
      }
    } catch {}
  }
  activeChildProcesses.clear();
}

/**
 * Resolves semantic tiers to concrete model IDs.
 */
export const TIER_TO_MODEL_MAP: Record<AgyTier, string> = {
  fast: 'gemini-3.8-flash-low',
  standard: 'gemini-3.8-flash-high',
  deep: 'gemini-3.1-pro-high',
};

/**
 * Resolves the path to the agy binary.
 * Checks environment variable, standard user locations, and system PATH.
 */
export function findAgyBinary(): string {
  if (cachedAgyPath && fs.existsSync(cachedAgyPath)) {
    return cachedAgyPath;
  }

  // 1. Explicit environment variable
  if (process.env.AGY_PATH && fs.existsSync(process.env.AGY_PATH)) {
    cachedAgyPath = process.env.AGY_PATH;
    return cachedAgyPath;
  }

  // 2. Common installation paths
  const candidates = [
    path.join(os.homedir(), '.local', 'bin', 'agy'),
    '/opt/homebrew/bin/agy',
    '/usr/local/bin/agy',
    '/usr/bin/agy',
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      try {
        fs.accessSync(candidate, fs.constants.X_OK);
        cachedAgyPath = candidate;
        return candidate;
      } catch {
        // Not executable, skip
      }
    }
  }

  // 3. Check system PATH via 'which'
  try {
    const whichOutput = execSync('which agy', { encoding: 'utf-8' }).trim();
    if (whichOutput && fs.existsSync(whichOutput)) {
      cachedAgyPath = whichOutput;
      return cachedAgyPath;
    }
  } catch {
    // which failed
  }

  throw new Error(
    'Antigravity CLI (agy) binary not found on PATH or in ~/.local/bin/agy. ' +
      'Please install agy or set the AGY_PATH environment variable.'
  );
}

/**
 * Inspects git status and diff in the specified directory.
 */
export function getWorkspaceGitDiff(
  workspaceDir: string,
  staged = false
): { modifiedFiles: string[]; diff: string } {
  try {
    const isGit = execSync('git rev-parse --is-inside-work-tree', {
      cwd: workspaceDir,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();

    if (isGit !== 'true') {
      return { modifiedFiles: [], diff: '' };
    }

    // List modified/untracked files without stripping initial character
    const statusOutput = execSync('git status --porcelain', {
      cwd: workspaceDir,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    const modifiedFiles = statusOutput
      .split('\n')
      .filter((line) => line.length >= 4)
      .map((line) => line.slice(3).trim());

    // Get git diff
    const diffCommand = staged ? 'git diff --cached' : 'git diff HEAD';
    let diff = '';
    try {
      diff = execSync(diffCommand, {
        cwd: workspaceDir,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
    } catch {
      try {
        diff = execSync('git diff', {
          cwd: workspaceDir,
          encoding: 'utf-8',
          stdio: ['ignore', 'pipe', 'ignore'],
        });
      } catch {
        diff = '';
      }
    }

    return { modifiedFiles, diff: diff.trim() };
  } catch {
    return { modifiedFiles: [], diff: '' };
  }
}

/**
 * Executes an Antigravity task via stream-json IPC.
 */
export async function executeAgyTask(
  options: AgyRunOptions,
  onStepUpdate?: (step: AgyStepSummary) => void
): Promise<AgyExecutionResult> {
  const agyPath = findAgyBinary();
  const cwd = options.workspaceDir
    ? path.resolve(options.workspaceDir)
    : process.cwd();

  if (!fs.existsSync(cwd)) {
    throw new Error(`Workspace directory does not exist: ${cwd}`);
  }

  // Determine target conversation ID:
  // 1. Explicit session_id / conversationId passed by caller (alias or UUID)
  // 2. Or connection's activeSessionId if not a one-off
  let targetConversationId: string | undefined;
  const aliasPassed = options.conversationId;

  if (options.conversationId) {
    targetConversationId = resolveSessionId(options.conversationId);
  } else if (!options.oneOff && currentActiveSessionId) {
    targetConversationId = currentActiveSessionId;
  }

  const args: string[] = [
    '--input-format',
    'stream-json',
    '--output-format',
    'stream-json',
  ];

  if (targetConversationId) {
    args.push('--conversation', targetConversationId);
  }

  // Handle mode mapping
  if (options.mode === 'plan' || options.mode === 'explain') {
    args.push('--mode', 'plan');
  } else if (options.mode === 'edit' || options.mode === 'accept-edits') {
    args.push('--mode', 'accept-edits');
  }

  if (options.effort) {
    args.push('--effort', options.effort);
  }

  // Model & Tier resolution
  if (options.model) {
    args.push('--model', options.model);
  } else if (options.tier && TIER_TO_MODEL_MAP[options.tier]) {
    args.push('--model', TIER_TO_MODEL_MAP[options.tier]);
  }

  if (options.dangerouslySkipPermissions !== false) {
    args.push('--dangerously-skip-permissions');
  }

  if (options.sandbox) {
    args.push('--sandbox');
  }

  if (options.addDirs && options.addDirs.length > 0) {
    for (const dir of options.addDirs) {
      args.push('--add-dir', path.resolve(dir));
    }
  }

  const timeoutMs = (options.timeoutSeconds ?? 600) * 1000;

  // Format prompt for explain mode if needed
  let promptText = options.prompt;
  if (options.mode === 'explain') {
    promptText = `[Strictly Read-Only Request - Do NOT edit any files or make destructive changes]\n${promptText}`;
  }

  return new Promise((resolve, reject) => {
    const proc = spawn(agyPath, args, {
      cwd,
      env: {
        ...process.env,
        PAGER: 'cat',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Register active child process for reaping
    activeChildProcesses.add(proc);

    let stdoutData = '';
    let stderrData = '';
    let conversationId = targetConversationId || '';
    let finalResult: Record<string, unknown> | null = null;
    let agentResponseText = '';
    const steps: AgyStepSummary[] = [];
    const stepMap = new Map<number, AgyStepSummary>();

    const cleanupProcessRegistration = () => {
      activeChildProcesses.delete(proc);
    };

    const timeoutTimer = setTimeout(() => {
      proc.kill('SIGTERM');
      const killTimer = setTimeout(() => proc.kill('SIGKILL'), 3000);
      killTimer.unref();
      cleanupProcessRegistration();
      reject(
        new Error(
          `Antigravity execution timed out after ${options.timeoutSeconds ?? 600} seconds`
        )
      );
    }, timeoutMs);

    // Stream user input message via stdin
    const userPayload = JSON.stringify({
      event: 'user',
      message: {
        content: promptText,
      },
    });

    proc.stdin.write(userPayload + '\n');
    proc.stdin.end();

    const rl = readline.createInterface({
      input: proc.stdout,
      crlfDelay: Infinity,
    });

    rl.on('line', (line) => {
      stdoutData += line + '\n';
      const trimmed = line.trim();
      if (!trimmed.startsWith('{')) return;

      try {
        const parsed = JSON.parse(trimmed);

        if (parsed.event === 'init') {
          if (parsed.conversation_id) {
            conversationId = parsed.conversation_id;
          }
        } else if (parsed.event === 'step_update' && parsed.step_update) {
          const update = parsed.step_update;
          const idx = update.step_index ?? steps.length;
          let existing = stepMap.get(idx);

          if (!existing) {
            existing = {
              stepIndex: idx,
              stepType: update.step_type || 'unknown',
              state: update.state || 'ACTIVE',
            };
            stepMap.set(idx, existing);
            steps.push(existing);
          }

          existing.state = update.state || existing.state;
          existing.stepType = update.step_type || existing.stepType;

          if (update.tool_name) {
            existing.toolName = update.tool_name;
          }

          if (update.tool_info) {
            existing.toolName = update.tool_info.name || existing.toolName;
            if (update.tool_info.parameters) {
              existing.toolParameters = update.tool_info.parameters;
            }
            if (update.tool_info.output !== undefined) {
              existing.toolOutput = String(update.tool_info.output);
            }
          }

          if (update.duration_seconds !== undefined) {
            existing.durationSeconds = update.duration_seconds;
          }

          if (update.text_delta) {
            agentResponseText += update.text_delta;
          }

          if (onStepUpdate) {
            onStepUpdate(existing);
          }
        } else if (parsed.event === 'result' && parsed.result) {
          finalResult = parsed.result;
          if (finalResult && typeof finalResult.conversation_id === 'string') {
            conversationId = finalResult.conversation_id;
          }
        }
      } catch {
        // Ignore JSON parse errors for non-JSON lines
      }
    });

    proc.stderr.on('data', (chunk) => {
      stderrData += chunk.toString();
    });

    proc.on('error', (err) => {
      clearTimeout(timeoutTimer);
      cleanupProcessRegistration();
      reject(new Error(`Failed to start agy process: ${err.message}`));
    });

    proc.on('close', (code) => {
      clearTimeout(timeoutTimer);
      cleanupProcessRegistration();

      // Post-task git diff check
      let postDiff = { modifiedFiles: [] as string[], diff: '' };
      if (options.includeDiff) {
        postDiff = getWorkspaceGitDiff(cwd);
      }

      const finishWithResult = (
        resStatus: 'SUCCESS' | 'ERROR',
        resText: string,
        resDuration: number,
        resTurns: number,
        resUsage?: AgyUsage,
        resError?: string,
        raw?: Record<string, unknown>
      ) => {
        const result: AgyExecutionResult = {
          conversationId,
          status: resStatus,
          response: resText,
          error: resError,
          durationSeconds: resDuration,
          numTurns: resTurns,
          usage: resUsage,
          steps,
          rawResult: raw,
          gitDiff: postDiff.diff,
          modifiedFiles: postDiff.modifiedFiles,
          isOneOff: Boolean(options.oneOff),
        };

        // Update connection active session and registry
        if (!options.oneOff && conversationId) {
          // If alias was passed (e.g. "worker-auth"), map it to the conversation UUID
          if (aliasPassed && aliasPassed !== conversationId) {
            registerSessionAlias(aliasPassed, conversationId);
          }

          // Automatically set as connection's active session
          currentActiveSessionId = conversationId;

          const now = new Date().toISOString();
          const existingSession = sessionRegistry.get(conversationId);

          if (existingSession) {
            existingSession.lastActiveAt = now;
            existingSession.turns += 1;
            existingSession.totalTokens += resUsage?.total_tokens ?? 0;
          } else {
            const shortTitle =
              options.prompt.length > 50
                ? `${options.prompt.slice(0, 47)}...`
                : options.prompt;

            sessionRegistry.set(conversationId, {
              id: conversationId,
              title: aliasPassed || shortTitle,
              createdAt: now,
              lastActiveAt: now,
              turns: resTurns,
              workspaceDir: cwd,
              totalTokens: resUsage?.total_tokens ?? 0,
            });
          }
        }

        resolve(result);
      };

      if (finalResult) {
        const status =
          (finalResult.status as 'SUCCESS' | 'ERROR') ||
          (code === 0 ? 'SUCCESS' : 'ERROR');
        const responseText =
          typeof finalResult.response === 'string' && finalResult.response.trim()
            ? finalResult.response
            : agentResponseText;

        const usage = finalResult.usage as AgyUsage | undefined;
        const duration =
          typeof finalResult.duration_seconds === 'number'
            ? finalResult.duration_seconds
            : 0;
        const numTurns =
          typeof finalResult.num_turns === 'number'
            ? finalResult.num_turns
            : 1;
        const errorMsg =
          typeof finalResult.error === 'string' ? finalResult.error : undefined;

        finishWithResult(
          status,
          responseText,
          duration,
          numTurns,
          usage,
          errorMsg,
          finalResult
        );
        return;
      }

      // Check if standard JSON was output
      try {
        const singleJson = JSON.parse(stdoutData.trim());
        if (singleJson && typeof singleJson === 'object') {
          finishWithResult(
            singleJson.status || (code === 0 ? 'SUCCESS' : 'ERROR'),
            singleJson.response || stdoutData,
            singleJson.duration_seconds || 0,
            singleJson.num_turns || 1,
            singleJson.usage,
            singleJson.error,
            singleJson
          );
          return;
        }
      } catch {
        // Not single JSON
      }

      if (code !== 0) {
        reject(
          new Error(
            `agy process exited with code ${code}.\nStderr: ${stderrData || '(none)'}\nStdout: ${stdoutData || '(none)'}`
          )
        );
      } else {
        finishWithResult(
          'SUCCESS',
          agentResponseText || stdoutData,
          0,
          1,
          undefined,
          undefined
        );
      }
    });
  });
}

/**
 * Session registry management helpers.
 */
export function listSessions(): (AgySessionInfo & {
  isActive: boolean;
  alias?: string;
})[] {
  return Array.from(sessionRegistry.values())
    .map((s) => ({
      ...s,
      isActive: s.id === currentActiveSessionId,
      alias: sessionIdToAliasMap.get(s.id),
    }))
    .sort(
      (a, b) =>
        new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime()
    );
}

export function getSession(id: string): AgySessionInfo | undefined {
  const resolved = resolveSessionId(id) || id;
  return sessionRegistry.get(resolved);
}

export function clearSessions(): number {
  const count = sessionRegistry.size;
  sessionRegistry.clear();
  aliasToSessionIdMap.clear();
  sessionIdToAliasMap.clear();
  currentActiveSessionId = null;
  return count;
}

export function deleteSession(id: string): boolean {
  const resolved = resolveSessionId(id) || id;
  if (currentActiveSessionId === resolved) {
    currentActiveSessionId = null;
  }
  const alias = sessionIdToAliasMap.get(resolved);
  if (alias) {
    aliasToSessionIdMap.delete(alias);
    sessionIdToAliasMap.delete(resolved);
  }
  return sessionRegistry.delete(resolved);
}

/**
 * Fetches available models by querying `agy models`.
 */
export async function listAgyModels(): Promise<AgyModelInfo[]> {
  const agyPath = findAgyBinary();

  return new Promise((resolve, reject) => {
    const proc = spawn(agyPath, ['models'], {
      env: { ...process.env, PAGER: 'cat' },
    });

    let output = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });

    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    proc.on('error', reject);

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`agy models exited with code ${code}: ${stderr}`));
        return;
      }

      const models: AgyModelInfo[] = [];
      const lines = output.split('\n');

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('Fetching')) continue;

        const parts = trimmed.split('\t');
        if (parts.length >= 2) {
          const id = parts[0].trim();
          const name = parts[1].trim();
          let recommendedTier: AgyTier | undefined;

          if (id === TIER_TO_MODEL_MAP.fast) recommendedTier = 'fast';
          else if (id === TIER_TO_MODEL_MAP.standard) recommendedTier = 'standard';
          else if (id === TIER_TO_MODEL_MAP.deep) recommendedTier = 'deep';

          models.push({ id, name, recommendedTier });
        }
      }

      resolve(models);
    });
  });
}

/**
 * Returns version and binary info for agy.
 */
export async function getAgyVersion(): Promise<{
  version: string;
  binaryPath: string;
}> {
  const agyPath = findAgyBinary();

  return new Promise((resolve, reject) => {
    const proc = spawn(agyPath, ['--version'], {
      env: { ...process.env, PAGER: 'cat' },
    });

    let output = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });

    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    proc.on('error', reject);

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`agy --version failed with code ${code}: ${stderr}`));
        return;
      }

      resolve({
        version: output.trim(),
        binaryPath: agyPath,
      });
    });
  });
}
