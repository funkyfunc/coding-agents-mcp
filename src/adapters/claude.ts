import { spawn, execFile } from 'node:child_process';
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
} from './types.js';
import { registerChildProcess, unregisterChildProcess } from '../reaper.js';
import { inspectGitWorkspace } from '../git.js';
import { resolveSessionId, recordSessionActivity } from '../session-store.js';

const execFileAsync = promisify(execFile);

export class ClaudeAdapter implements BaseAgentAdapter {
  readonly id: AgentId = 'claude';
  readonly name = 'Anthropic Claude Code';

  private cachedBinaryPath: string | null = null;
  private cachedVersion: string | null = null;

  /**
   * Locate the claude CLI binary on the host machine.
   */
  findBinary(): string {
    if (this.cachedBinaryPath && fs.existsSync(this.cachedBinaryPath)) {
      return this.cachedBinaryPath;
    }

    if (process.env.CLAUDE_BIN && fs.existsSync(process.env.CLAUDE_BIN)) {
      this.cachedBinaryPath = process.env.CLAUDE_BIN;
      return this.cachedBinaryPath;
    }

    const standardPaths = [
      path.join(os.homedir(), '.local', 'bin', 'claude'),
      path.join(os.homedir(), '.npm-global', 'bin', 'claude'),
      '/usr/local/bin/claude',
      '/opt/homebrew/bin/claude',
    ];

    for (const p of standardPaths) {
      if (fs.existsSync(p)) {
        this.cachedBinaryPath = p;
        return p;
      }
    }

    // Fall back to PATH resolution
    this.cachedBinaryPath = 'claude';
    return 'claude';
  }

  async isAvailable(): Promise<boolean> {
    try {
      const binary = this.findBinary();
      const res = await execFileAsync(binary, ['--version']);
      return res.stdout.toLowerCase().includes('claude');
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
      this.cachedVersion = version;
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
      models: ['haiku', 'sonnet', 'opus'],
      defaultModel: 'haiku',
      thinkingLevels: ['low', 'medium', 'high', 'xhigh', 'max'],
      capabilities: {
        modes: ['edit', 'plan', 'explain'],
        supportsThinking: true,
        thinkingLevels: ['low', 'medium', 'high', 'xhigh', 'max'],
        supportsWorktreeIsolation: true,
        supportsSandbox: false,
        supportsAddDirs: true,
        supportsMultiTurn: true,
        supportsCustomSkills: false,
      },
      notes: installed
        ? 'Claude Code CLI detected and ready for autonomous delegation.'
        : 'Claude Code CLI not found. Install via: npm install -g @anthropic-ai/claude-code',
    };
  }

  async execute(options: AgentTaskOptions): Promise<AgentTaskResult> {
    const startTime = Date.now();
    const workspaceDir = options.workspaceDir || process.cwd();
    const binary = this.findBinary();

    // 1. Session resolution
    const sessionRes = resolveSessionId(this.id, options.sessionId);
    const isResuming = !options.oneOff && !sessionRes.isNew && !!sessionRes.sessionId;

    // 2. Build CLI arguments
    const args: string[] = ['-p']; // Headless print mode

    // Output format
    args.push('--output-format', 'json');

    // Permissions: Skip interactive confirmations
    if (options.dangerouslySkipPermissions !== false) {
      args.push('--dangerously-skip-permissions');
    }

    // Model selection (default to haiku for fast & cost-efficient execution)
    const model = options.model || 'haiku';
    args.push('--model', model);

    // Thinking / Effort level
    const effort = options.agentOptions?.claude?.effort || options.thinking;
    if (effort) {
      const validEfforts = ['low', 'medium', 'high', 'xhigh', 'max'];
      if (validEfforts.includes(effort.toLowerCase())) {
        args.push('--effort', effort.toLowerCase());
      }
    }

    // Agent options: Compact flag
    if (options.agentOptions?.claude?.compact) {
      args.push('--compact');
    }

    // Agent options: Custom CLI flags passthrough & rawArgs
    const rawFlags = [
      ...(options.rawArgs || []),
      ...(options.agentOptions?.claude?.customFlags || []),
    ];
    for (const flag of rawFlags) {
      args.push(flag);
    }

    // Session flags
    if (options.oneOff) {
      args.push('--no-session-persistence');
    } else if (isResuming && sessionRes.sessionId) {
      args.push('-r', sessionRes.sessionId);
    } else if (sessionRes.sessionId) {
      args.push('--session-id', sessionRes.sessionId);
    }

    // Build prompt payload with contextual mode prefixing
    let finalPrompt = options.prompt;
    if (options.agentOptions?.claude?.appendSystemPrompt) {
      finalPrompt = `[SYSTEM INSTRUCTION: ${options.agentOptions.claude.appendSystemPrompt}]\n${finalPrompt}`;
    }
    if (options.mode === 'plan') {
      finalPrompt = `[MODE: ARCHITECTURAL PLAN - DO NOT MODIFY ANY FILES]\n${options.prompt}`;
    } else if (options.mode === 'explain') {
      finalPrompt = `[MODE: CODEBASE INQUIRY - READ ONLY]\n${options.prompt}`;
    }

    // Add prompt as the final positional argument
    args.push(finalPrompt);

    // 3. Spawn child process
    return new Promise<AgentTaskResult>((resolve) => {
      let stdoutData = '';
      let stderrData = '';
      let childPid = 0;
      let isSettled = false;

      const timeoutMs = (options.timeoutSeconds || 600) * 1000;
      let timer: NodeJS.Timeout | null = null;

      const finish = async (result: AgentTaskResult) => {
        if (isSettled) return;
        isSettled = true;

        if (timer) clearTimeout(timer);
        if (childPid) unregisterChildProcess(childPid);

        // Capture git diff if requested
        if (options.includeDiff !== false) {
          result.diff = await inspectGitWorkspace(workspaceDir);
        }

        resolve(result);
      };

      try {
        const child = spawn(binary, args, {
          cwd: workspaceDir,
          stdio: ['pipe', 'pipe', 'pipe'],
          env: {
            ...process.env,
            FORCE_COLOR: '0',
            NO_COLOR: '1',
          },
        });

        childPid = child.pid || 0;
        if (childPid) {
          registerChildProcess(child, 'claude', options.prompt);
        }

        // CRITICAL: Immediately close stdin to prevent Claude's 3s stdin delay
        if (child.stdin) {
          child.stdin.end();
        }

        // Setup execution timeout
        timer = setTimeout(() => {
          if (!isSettled && childPid) {
            process.stderr.write(
              `[coding-agents-mcp] Claude task timed out after ${options.timeoutSeconds || 600}s. Terminating PID ${childPid}...\n`
            );
            try {
              child.kill('SIGTERM');
              setTimeout(() => {
                try {
                  child.kill('SIGKILL');
                } catch {}
              }, 1500);
            } catch {}

            finish({
              success: false,
              agent: this.id,
              output: stdoutData,
              error: `Task timed out after ${options.timeoutSeconds || 600} seconds.`,
              sessionId: sessionRes.sessionId,
              sessionAlias: sessionRes.alias,
              durationMs: Date.now() - startTime,
              modelUsed: model,
            });
          }
        }, timeoutMs);

        child.stdout?.on('data', (chunk: Buffer) => {
          stdoutData += chunk.toString('utf8');
        });

        child.stderr?.on('data', (chunk: Buffer) => {
          stderrData += chunk.toString('utf8');
        });

        child.on('error', (err: Error) => {
          finish({
            success: false,
            agent: this.id,
            output: stdoutData,
            error: `Failed to execute Claude Code CLI: ${err.message}`,
            sessionId: sessionRes.sessionId,
            sessionAlias: sessionRes.alias,
            durationMs: Date.now() - startTime,
            modelUsed: model,
          });
        });

        child.on('close', (code: number | null) => {
          const durationMs = Date.now() - startTime;

          // Parse JSON output from Claude Code
          let parsed: any = null;
          try {
            const firstBrace = stdoutData.indexOf('{');
            const lastBrace = stdoutData.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace > firstBrace) {
              const jsonSlice = stdoutData.slice(firstBrace, lastBrace + 1);
              parsed = JSON.parse(jsonSlice);
            }
          } catch {}

          if (parsed && typeof parsed === 'object') {
            const actualSessionId = parsed.session_id || sessionRes.sessionId;
            const outputText = parsed.result || stdoutData.trim();
            const costUsd = parsed.total_cost_usd;
            const turns = parsed.num_turns || 1;

            const tokens: AgentTokens = {
              total:
                (parsed.usage?.input_tokens || 0) +
                (parsed.usage?.output_tokens || 0),
              input: parsed.usage?.input_tokens,
              output: parsed.usage?.output_tokens,
              thinking: parsed.usage?.output_tokens_details?.thinking_tokens,
              cache:
                (parsed.usage?.cache_read_input_tokens || 0) +
                (parsed.usage?.cache_creation_input_tokens || 0),
            };

            // Update session registry if not a one-off run
            if (!options.oneOff && actualSessionId) {
              recordSessionActivity(
                this.id,
                actualSessionId,
                tokens.total || 0,
                options.prompt.slice(0, 60),
                sessionRes.alias
              );
            }

            finish({
              success: parsed.is_error ? false : code === 0,
              agent: this.id,
              output: outputText,
              error: parsed.is_error ? outputText : undefined,
              sessionId: actualSessionId,
              sessionAlias: sessionRes.alias,
              durationMs,
              turns,
              tokens,
              costUsd,
              modelUsed: model,
              isOneOff: options.oneOff,
            });
          } else {
            const isSuccess = code === 0;
            finish({
              success: isSuccess,
              agent: this.id,
              output: stdoutData.trim() || stderrData.trim(),
              error: isSuccess ? undefined : stderrData.trim() || `Process exited with code ${code}`,
              sessionId: sessionRes.sessionId,
              sessionAlias: sessionRes.alias,
              durationMs,
              modelUsed: model,
              isOneOff: options.oneOff,
            });
          }
        });
      } catch (err: any) {
        finish({
          success: false,
          agent: this.id,
          output: '',
          error: `Execution exception: ${err.message}`,
          durationMs: Date.now() - startTime,
          modelUsed: model,
        });
      }
    });
  }
}
