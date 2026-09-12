import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { registry } from '../adapters/registry.js';
import { AgentId } from '../adapters/types.js';
import { formatAgentResponse } from './formatters.js';
import { worktreeManager } from '../worktree.js';

/**
 * Sanitize raw arguments passed to underlying agent CLI binaries.
 * Blocks shell injection attempts, metacharacters, and conflicting internal flags.
 */
export function sanitizeRawArgs(rawArgs?: string[]): string[] {
  if (!rawArgs || !Array.isArray(rawArgs)) return [];

  const forbiddenFlagPatterns = [
    /^--print$/,
    /^-p$/,
    /^--output-format/,
    /^--resume/,
    /^--continue/,
    /^--session/,
    /^--dangerously-skip-permissions$/, // managed exclusively by hypervisor
    /^--eval$/,
  ];

  // Shell chaining / command injection metacharacters
  const dangerousCharRegex = /[;&|`$<>]/;

  const sanitized: string[] = [];

  for (const arg of rawArgs) {
    if (typeof arg !== 'string') continue;
    const trimmed = arg.trim();
    if (!trimmed) continue;

    // Check for dangerous shell metacharacters
    if (dangerousCharRegex.test(trimmed)) {
      throw new Error(
        `Security Exception: Forbidden shell metacharacters detected in raw_args: "${trimmed}"`
      );
    }

    // Check against forbidden control flags
    const isForbidden = forbiddenFlagPatterns.some((pattern) => pattern.test(trimmed));
    if (isForbidden) {
      process.stderr.write(
        `[coding-agents-mcp] Notice: Stripping hypervisor-controlled flag from raw_args: "${trimmed}"\n`
      );
      continue;
    }

    sanitized.push(trimmed);
  }

  return sanitized;
}

export function registerTaskTools(server: McpServer): void {
  // 1. Primary Polymorphic Workhorse Tool: delegate_task
  server.tool(
    'delegate_task',
    'Delegate a coding task, bug fix, architectural refactor, or test implementation to a local autonomous CLI coding agent (Claude Code, Antigravity, Codex, Cursor). Automatically preserves conversation context across turns within this connection (zero-token overhead).',
    {
      prompt: z
        .string()
        .describe(
          'Task instruction, objective, and acceptance criteria for the coding agent. Best practice for supervisors: specify WHAT to accomplish, non-negotiable invariants, and test verification criteria. The worker operates autonomously with full tool access (reading/writing files, executing shell commands, resolving compiler/test errors) without micro-management.'
        ),
      agent: z
        .enum(['auto', 'claude', 'agy', 'codex', 'cursor'])
        .optional()
        .default('auto')
        .describe(
          'Target CLI agent backend. "auto" selects the best installed agent (prioritizes Claude Code and Antigravity).'
        ),
      session_id: z
        .string()
        .optional()
        .describe(
          'Optional session ID or friendly name (e.g., "auth-worker", "refactor"). If omitted, automatically continues the active conversation for this agent on this connection. Pass "new" to start a fresh conversation.'
        ),
      model: z
        .string()
        .optional()
        .describe(
          'Explicit model selection:\n- Claude: "haiku" (default, fast/economical), "sonnet", "opus"\n- Antigravity: "gemini-3.8-flash-low" (default), "gemini-3.8-flash-high", "gemini-3.1-pro"\n- Codex: "gpt-4o-mini", "gpt-4o", "o3-mini"'
        ),
      thinking: z
        .string()
        .optional()
        .describe(
          'Thinking effort level:\n- Claude: "low", "medium", "high", "xhigh", "max"\n- Antigravity: "low", "high"'
        ),
      mode: z
        .enum(['edit', 'plan', 'explain'])
        .optional()
        .default('edit')
        .describe(
          'Execution mode:\n- "edit": Autonomous pair programming with code editing & terminal execution.\n- "plan": Non-destructive architectural design without modifying files.\n- "explain": Read-only codebase inquiry and diagnostics.'
        ),
      workspace_dir: z
        .string()
        .optional()
        .describe(
          'Target workspace directory. Defaults to the current working directory.'
        ),
      one_off: z
        .boolean()
        .optional()
        .default(false)
        .describe(
          'If true, executes as a stateless one-off task without binding to or modifying the connection active session.'
        ),
      include_diff: z
        .boolean()
        .optional()
        .default(true)
        .describe(
          'Automatically include a git diff summary of working directory modifications.'
        ),
      isolate_worktree: z
        .boolean()
        .optional()
        .default(false)
        .describe(
          'Execute the task in an isolated ephemeral git worktree. Protects the main repository branch against dirty edits, conflicts, and file locking.'
        ),
      skills: z
        .array(z.string())
        .optional()
        .describe(
          'Specialized domain skills to inject into the agent run (e.g. ["agy-customizations"]). Supported natively by Google Antigravity.'
        ),
      sandbox: z
        .boolean()
        .optional()
        .describe(
          'Execute the agent inside an isolated process container / sandbox. Supported natively by Google Antigravity.'
        ),
      agent_options: z
        .record(z.any())
        .optional()
        .describe(
          'Deep configuration bag for agent-specific options (e.g. claude: { compact: true, effort: "high" }, agy: { sandbox: true, skills: [...] }).'
        ),
      raw_args: z
        .array(z.string())
        .optional()
        .describe(
          'Arbitrary CLI arguments to pass directly to the agent binary (e.g. ["--verbose", "--custom-flag"]). Enables instant access to newly released upstream CLI features.'
        ),
      timeout_seconds: z
        .number()
        .optional()
        .default(600)
        .describe('Execution timeout in seconds (default: 600s / 10m).'),
      add_dirs: z
        .array(z.string())
        .optional()
        .describe('Additional directories to mount into the agent workspace.'),
    },
    async (args) => {
      try {
        const adapter = await registry.resolve(args.agent as AgentId);

        let effectiveWorkspaceDir = args.workspace_dir;
        let worktreeInstance: any;

        if (args.isolate_worktree) {
          const alias = args.session_id || `task-${Date.now()}`;
          worktreeInstance = await worktreeManager.createWorktree(
            alias,
            args.workspace_dir || process.cwd()
          );
          effectiveWorkspaceDir = worktreeInstance.worktreePath;
        }

        const result = await adapter.execute({
          prompt: args.prompt,
          workspaceDir: effectiveWorkspaceDir,
          sessionId: args.session_id,
          model: args.model,
          thinking: args.thinking,
          mode: args.mode,
          oneOff: args.one_off,
          includeDiff: args.include_diff,
          timeoutSeconds: args.timeout_seconds,
          addDirs: args.add_dirs,
          isolateWorktree: args.isolate_worktree,
          skills: args.skills,
          sandbox: args.sandbox,
          rawArgs: sanitizeRawArgs(args.raw_args),
          agentOptions: args.agent_options,
          dangerouslySkipPermissions: true,
        });

        if (worktreeInstance) {
          result.worktreePath = worktreeInstance.worktreePath;
          result.worktreeBranch = worktreeInstance.branchName;
        }

        const formatted = formatAgentResponse(
          result,
          args.mode === 'plan'
            ? 'Plan'
            : args.mode === 'explain'
              ? 'Explanation'
              : 'Task Execution'
        );

        return {
          content: [
            {
              type: 'text',
              text: formatted,
            },
          ],
          isError: !result.success,
        };
      } catch (err: any) {
        return {
          content: [
            {
              type: 'text',
              text: `⚠️ **Task Delegation Error:** ${err.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // 2. Dedicated Stateless One-Off Tool: delegate_ask
  server.tool(
    'delegate_ask',
    'Execute a fast, read-only question, diagnostic inquiry, or code review with a CLI coding agent without creating or altering conversation session state.',
    {
      prompt: z
        .string()
        .describe('Inquiry, explanation request, or diagnostic prompt.'),
      agent: z
        .enum(['auto', 'claude', 'agy', 'codex', 'cursor'])
        .optional()
        .default('auto')
        .describe('Target CLI agent backend (defaults to "auto").'),
      model: z
        .string()
        .optional()
        .describe('Model override (e.g. "haiku", "gemini-3.8-flash-low").'),
      thinking: z
        .string()
        .optional()
        .describe('Thinking effort level (e.g. "low", "medium", "high").'),
      workspace_dir: z
        .string()
        .optional()
        .describe('Target workspace directory.'),
      timeout_seconds: z
        .number()
        .optional()
        .default(120)
        .describe('Execution timeout in seconds (default: 120s).'),
      agent_options: z
        .record(z.any())
        .optional()
        .describe('Deep configuration bag for agent-specific options.'),
      raw_args: z
        .array(z.string())
        .optional()
        .describe('Arbitrary CLI arguments to pass directly to the agent binary.'),
    },
    async (args) => {
      try {
        const adapter = await registry.resolve(args.agent as AgentId);

        const result = await adapter.execute({
          prompt: args.prompt,
          workspaceDir: args.workspace_dir,
          model: args.model,
          thinking: args.thinking,
          mode: 'explain',
          oneOff: true,
          includeDiff: false,
          timeoutSeconds: args.timeout_seconds,
          rawArgs: sanitizeRawArgs(args.raw_args),
          agentOptions: args.agent_options,
          dangerouslySkipPermissions: true,
        });

        const formatted = formatAgentResponse(result, 'One-Off Query');

        return {
          content: [
            {
              type: 'text',
              text: formatted,
            },
          ],
          isError: !result.success,
        };
      } catch (err: any) {
        return {
          content: [
            {
              type: 'text',
              text: `⚠️ **Query Error:** ${err.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // 3. Backward-Compatible Aliases for agy-mcp callers
  server.tool(
    'agy_task',
    '[Legacy Alias -> delegate_task(agent="agy")] Delegate a coding task to Google Antigravity.',
    {
      prompt: z.string().describe('Task instruction or bug description.'),
      workspace_dir: z.string().optional(),
      session_id: z.string().optional(),
      mode: z.enum(['edit', 'plan', 'explain']).optional().default('edit'),
      model: z.string().optional(),
      thinking: z.string().optional(),
      one_off: z.boolean().optional().default(false),
      include_diff: z.boolean().optional().default(true),
      timeout_seconds: z.number().optional().default(600),
      add_dirs: z.array(z.string()).optional(),
      skills: z.array(z.string()).optional().describe('Domain skills to activate (e.g. ["agy-customizations"]).'),
      sandbox: z.boolean().optional().describe('Run inside container sandbox.'),
    },
    async (args) => {
      const adapter = await registry.resolve('agy');
      const result = await adapter.execute({
        prompt: args.prompt,
        workspaceDir: args.workspace_dir,
        sessionId: args.session_id,
        model: args.model,
        thinking: args.thinking,
        mode: args.mode,
        oneOff: args.one_off,
        includeDiff: args.include_diff,
        timeoutSeconds: args.timeout_seconds,
        addDirs: args.add_dirs,
        skills: args.skills,
        sandbox: args.sandbox,
        dangerouslySkipPermissions: true,
      });

      return {
        content: [{ type: 'text', text: formatAgentResponse(result, 'Antigravity Execution') }],
        isError: !result.success,
      };
    }
  );

  server.tool(
    'agy_ask',
    '[Legacy Alias -> delegate_ask(agent="agy")] Fast stateless inquiry with Google Antigravity.',
    {
      prompt: z.string().describe('Inquiry or diagnostic prompt.'),
      workspace_dir: z.string().optional(),
      model: z.string().optional(),
      timeout_seconds: z.number().optional().default(120),
    },
    async (args) => {
      const adapter = await registry.resolve('agy');
      const result = await adapter.execute({
        prompt: args.prompt,
        workspaceDir: args.workspace_dir,
        model: args.model,
        mode: 'explain',
        oneOff: true,
        includeDiff: false,
        timeoutSeconds: args.timeout_seconds,
        dangerouslySkipPermissions: true,
      });

      return {
        content: [{ type: 'text', text: formatAgentResponse(result, 'Antigravity Query') }],
        isError: !result.success,
      };
    }
  );
}
