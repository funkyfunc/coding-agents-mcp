import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { executeAgyTask } from '../agy-runner.js';
import { formatAgyResponse } from './formatters.js';

export function registerRunTaskTool(server: McpServer): void {
  server.tool(
    'agy_run_task',
    'Delegate a software engineering task, bug fix, refactoring, or feature implementation to Google Antigravity (agy). The agent operates autonomously with full tool access (file editing, terminal commands, web search, subagents).',
    {
      prompt: z
        .string()
        .describe(
          'The prompt or instruction for Antigravity (e.g., "Refactor auth middleware to support JWT refresh", "Fix unit tests in payment_service.py").'
        ),
      workspace_dir: z
        .string()
        .optional()
        .describe(
          'Absolute or relative path to the workspace directory. Defaults to the current working directory.'
        ),
      mode: z
        .enum(['accept-edits', 'plan'])
        .optional()
        .describe(
          'Execution mode: "accept-edits" (default) allows direct code changes. "plan" creates an implementation plan without modifying files.'
        ),
      effort: z
        .enum(['low', 'medium', 'high'])
        .optional()
        .describe('Reasoning effort level: low, medium, or high (default: high).'),
      model: z
        .string()
        .optional()
        .describe(
          'Model override (e.g., "gemini-3.8-flash-high", "gemini-3.1-pro-high", "claude-sonnet-4-6"). Use agy_list_models to view choices.'
        ),
      conversation_id: z
        .string()
        .optional()
        .describe(
          'Optional conversation ID if you want to resume an existing session.'
        ),
      dangerously_skip_permissions: z
        .boolean()
        .optional()
        .describe(
          'Auto-approve all tool permission requests without prompting (default: true, recommended for agent-to-agent automation).'
        ),
      timeout_seconds: z
        .number()
        .optional()
        .describe('Execution timeout in seconds (default: 600 / 10 minutes).'),
      add_dirs: z
        .array(z.string())
        .optional()
        .describe(
          'Additional workspace directories to mount into the agent context.'
        ),
    },
    async (args) => {
      try {
        const result = await executeAgyTask({
          prompt: args.prompt,
          workspaceDir: args.workspace_dir,
          mode: args.mode,
          effort: args.effort,
          model: args.model,
          conversationId: args.conversation_id,
          dangerouslySkipPermissions: args.dangerously_skip_permissions ?? true,
          timeoutSeconds: args.timeout_seconds ?? 600,
          addDirs: args.add_dirs,
        });

        const formatted = formatAgyResponse(result, 'Task Execution');
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
              text: `❌ Failed to execute Antigravity task:\n\n${err.message || String(err)}`,
            },
          ],
        };
      }
    }
  );
}
