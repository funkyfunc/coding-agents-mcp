import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  BaseAgentAdapter,
  AgentId,
  AgentStatus,
  AgentTaskOptions,
  AgentTaskResult,
  AgentTokens,
  AgentToolUse,
} from './types.js';
import { executeAgyTask, findAgyBinary, getSessionAlias } from '../agy-runner.js';
import { inspectGitWorkspace } from '../git.js';

const execFileAsync = promisify(execFile);

export class AgyAdapter implements BaseAgentAdapter {
  readonly id: AgentId = 'agy';
  readonly name = 'Google Antigravity';

  private cachedBinaryPath: string | null = null;

  findBinary(): string {
    if (this.cachedBinaryPath && fs.existsSync(this.cachedBinaryPath)) {
      return this.cachedBinaryPath;
    }

    try {
      this.cachedBinaryPath = findAgyBinary();
      return this.cachedBinaryPath;
    } catch {
      this.cachedBinaryPath = 'agy';
      return 'agy';
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const binary = this.findBinary();
      const res = await execFileAsync(binary, ['--version']);
      return res.stdout.toLowerCase().includes('antigravity') || res.stdout.includes('1.');
    } catch {
      return false;
    }
  }

  async getStatus(): Promise<AgentStatus> {
    const binary = this.findBinary();
    let installed = false;
    let version: string | undefined;

    try {
      const res = await execFileAsync(binary, ['--version']);
      installed = true;
      version = res.stdout.trim();
    } catch {
      installed = false;
    }

    return {
      id: this.id,
      name: this.name,
      installed,
      binaryPath: installed ? binary : undefined,
      version,
      authenticated: installed,
      models: [
        'gemini-3.8-flash-low',
        'gemini-3.8-flash-high',
        'gemini-3.1-pro',
        'claude-opus-4.6',
      ],
      defaultModel: 'gemini-3.8-flash-low',
      thinkingLevels: ['low', 'high'],
      notes: installed
        ? 'Google Antigravity CLI detected and ready for autonomous delegation.'
        : 'Google Antigravity CLI not found. Install via: npm install -g @google/antigravity-cli',
    };
  }

  async execute(options: AgentTaskOptions): Promise<AgentTaskResult> {
    const startTime = Date.now();
    const workspaceDir = options.workspaceDir || process.cwd();

    try {
      // Map effort from thinking parameter if provided
      let effort: 'low' | 'medium' | 'high' = 'medium';
      if (options.thinking === 'low') effort = 'low';
      else if (options.thinking === 'high') effort = 'high';

      const agyRes = await executeAgyTask({
        prompt: options.prompt,
        workspaceDir: options.workspaceDir,
        conversationId: options.sessionId,
        mode: options.mode === 'plan' ? 'plan' : options.mode === 'explain' ? 'explain' : 'edit',
        model: options.model,
        effort,
        oneOff: options.oneOff,
        includeDiff: false, // We inspect diff non-destructively via git.ts
        timeoutSeconds: options.timeoutSeconds,
        addDirs: options.addDirs,
        dangerouslySkipPermissions: options.dangerouslySkipPermissions !== false,
      });

      const tokens: AgentTokens = {
        total: agyRes.usage?.total_tokens,
        input: agyRes.usage?.input_tokens,
        output: agyRes.usage?.output_tokens,
        thinking: agyRes.usage?.thinking_tokens,
        cache: agyRes.usage?.cache_read_tokens,
      };

      const toolsUsed: AgentToolUse[] = agyRes.steps
        .filter((s) => s.stepType === 'tool' && s.toolName)
        .map((s) => {
          const rawTarget =
            s.toolParameters?.AbsolutePath ||
            s.toolParameters?.CommandLine ||
            s.toolParameters?.DirectoryPath ||
            s.toolParameters?.Query;

          return {
            name: s.toolName!,
            target: rawTarget ? String(rawTarget) : undefined,
            status: s.state === 'ERROR' ? ('ERROR' as const) : ('DONE' as const),
          };
        });

      const sessionAlias = agyRes.conversationId
        ? getSessionAlias(agyRes.conversationId)
        : undefined;

      let diff = undefined;
      if (options.includeDiff !== false) {
        diff = await inspectGitWorkspace(workspaceDir);
      }

      return {
        success: agyRes.status === 'SUCCESS',
        agent: this.id,
        output: agyRes.response || '',
        error: agyRes.error,
        sessionId: agyRes.conversationId,
        sessionAlias,
        durationMs: agyRes.durationSeconds * 1000,
        turns: agyRes.numTurns,
        tokens,
        toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined,
        diff,
        modelUsed: options.model || 'gemini-3.8-flash-low',
        isOneOff: options.oneOff,
      };
    } catch (err: any) {
      return {
        success: false,
        agent: this.id,
        output: '',
        error: err.message,
        durationMs: Date.now() - startTime,
        isOneOff: options.oneOff,
      };
    }
  }
}
