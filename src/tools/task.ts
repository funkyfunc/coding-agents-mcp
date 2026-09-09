import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { executeAgyTask, resetActiveSession } from '../agy-runner.js';
import { formatAgyResponse } from './formatters.js';

export function registerTaskTools(server: McpServer): void {
  // 1. Primary Unified Workhorse Tool: agy_task
  server.tool(
    'agy_task',
    'Delegate a coding task, bug fix, architectural plan, or codebase inquiry to Google Antigravity. By default, maintains conversation memory automatically across turns within this connection (zero-token overhead). Supports friendly session names (e.g., "frontend", "backend") and semantic intelligence tiers.',
    {
      prompt: z
        .string()
        .describe(
          'Task instruction, bug description, or follow-up prompt for Antigravity.'
        ),
      workspace_dir: z
        .string()
        .optional()
        .describe(
          'Target workspace directory. Defaults to the current working directory.'
        ),
      session_id: z
        .string()
        .optional()
        .describe(
          'Optional session ID or friendly name (e.g., "auth-worker"). If omitted, automatically continues the active conversation on this connection. Pass "new" or call agy_reset to start a fresh conversation.'
        ),
      mode: z
        .enum(['edit', 'plan', 'explain'])
        .optional()
        .default('edit')
        .describe(
          'Execution mode:\n- "edit": Autonomous pair programming with code editing & terminal execution.\n- "plan": Non-destructive architectural planning without touching files.\n- "explain": Read-only codebase inquiry and diagnostics.'
        ),
      tier: z
        .enum(['fast', 'standard', 'deep'])
        .optional()
        .default('standard')
        .describe(
          'Semantic reasoning tier:\n- "fast": Ultra-low latency & simple fixes (Gemini 3.8 Flash Low)\n- "standard": Balanced reasoning & high-speed coding (Gemini 3.8 Flash High)\n- "deep": Complex multi-file architecture & deep reasoning (Gemini 3.1 Pro / Claude Opus 4.6)'
        ),
      model: z
        .string()
        .optional()
        .describe('Explicit model ID override (takes precedence over tier).'),
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
        let conversationId = args.session_id;
        if (conversationId === 'new') {
          resetActiveSession();
          conversationId = undefined;
        }

        const result = await executeAgyTask({
          prompt: args.prompt,
          workspaceDir: args.workspace_dir,
          conversationId,
          mode: args.mode,
          tier: args.tier,
          model: args.model,
          oneOff: args.one_off,
          includeDiff: args.include_diff,
          timeoutSeconds: args.timeout_seconds,
          addDirs: args.add_dirs,
          dangerouslySkipPermissions: true,
        });

        const formatted = formatAgyResponse(
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
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `❌ Antigravity task execution failed:\n\n${err.message || String(err)}`,
            },
          ],
        };
      }
    }
  );

  // 2. Dedicated Stateless One-Off Tool: agy_ask
  server.tool(
    'agy_ask',
    'Execute a quick, stateless one-off query or explanation with Antigravity. Strictly read-only; never mutates files, never touches the connection active session, and leaves zero session residue.',
    {
      prompt: z
        .string()
        .describe(
          'Question, code snippet to explain, or diagnostic query for Antigravity.'
        ),
      workspace_dir: z
        .string()
        .optional()
        .describe('Workspace directory to reference for context.'),
      tier: z
        .enum(['fast', 'standard', 'deep'])
        .optional()
        .default('fast')
        .describe(
          'Intelligence tier: "fast" (default for quick queries), "standard", or "deep".'
        ),
      model: z.string().optional().describe('Explicit model override ID.'),
      timeout_seconds: z
        .number()
        .optional()
        .default(180)
        .describe('Execution timeout in seconds (default: 180s / 3m).'),
    },
    async (args) => {
      try {
        const result = await executeAgyTask({
          prompt: args.prompt,
          workspaceDir: args.workspace_dir,
          mode: 'explain',
          tier: args.tier,
          model: args.model,
          oneOff: true,
          includeDiff: false,
          timeoutSeconds: args.timeout_seconds,
          dangerouslySkipPermissions: true,
        });

        const formatted = formatAgyResponse(result, 'One-Off Query');
        return {
          content: [
            {
              type: 'text',
              text: formatted,
            },
          ],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `❌ One-off query failed:\n\n${err.message || String(err)}`,
            },
          ],
        };
      }
    }
  );
}
