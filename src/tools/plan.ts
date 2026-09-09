import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { executeAgyTask } from '../agy-runner.js';
import { formatAgyResponse } from './formatters.js';

export function registerPlanTool(server: McpServer): void {
  server.tool(
    'agy_plan',
    'Invoke Antigravity in planning mode (--mode plan) to inspect the codebase and generate an architectural, refactoring, or implementation plan without modifying any files.',
    {
      prompt: z
        .string()
        .describe(
          'The feature, refactor, or problem to plan (e.g. "Plan migration from REST to GraphQL", "Audit security of session cookies").'
        ),
      workspace_dir: z
        .string()
        .optional()
        .describe('Workspace directory to inspect (defaults to current working directory).'),
      effort: z
        .enum(['low', 'medium', 'high'])
        .optional()
        .describe('Reasoning effort level (defaults to "high" for architectural planning).'),
      model: z
        .string()
        .optional()
        .describe('Specific model override (e.g. "gemini-3.1-pro-high", "claude-opus-4-6-thinking").'),
      conversation_id: z
        .string()
        .optional()
        .describe('Optional conversation ID to build upon an existing context.'),
      timeout_seconds: z
        .number()
        .optional()
        .describe('Execution timeout in seconds (default: 300 / 5 minutes).'),
      add_dirs: z
        .array(z.string())
        .optional()
        .describe('Additional workspace directories to include.'),
    },
    async (args) => {
      try {
        const result = await executeAgyTask({
          prompt: args.prompt,
          workspaceDir: args.workspace_dir,
          mode: 'plan',
          effort: args.effort ?? 'high',
          model: args.model,
          conversationId: args.conversation_id,
          dangerouslySkipPermissions: true,
          timeoutSeconds: args.timeout_seconds ?? 300,
          addDirs: args.add_dirs,
        });

        const formatted = formatAgyResponse(result, 'Architectural Plan');
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
              text: `❌ Failed to generate plan with Antigravity:\n\n${err.message || String(err)}`,
            },
          ],
        };
      }
    }
  );
}
