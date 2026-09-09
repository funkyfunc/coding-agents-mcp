import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { executeAgyTask } from '../agy-runner.js';
import { formatAgyResponse } from './formatters.js';

export function registerChatTool(server: McpServer): void {
  server.tool(
    'agy_chat',
    'Continue a multi-turn conversation with Google Antigravity. Preserves context, memory, and changes from previous turns using the conversation ID.',
    {
      conversation_id: z
        .string()
        .describe(
          'The conversation ID returned from a prior agy_run_task, agy_plan, or agy_chat call.'
        ),
      prompt: z
        .string()
        .describe(
          'Follow-up instruction, question, correction, or review feedback.'
        ),
      workspace_dir: z
        .string()
        .optional()
        .describe('Workspace directory (defaults to current working directory).'),
      effort: z
        .enum(['low', 'medium', 'high'])
        .optional()
        .describe('Reasoning effort level: low, medium, or high.'),
      model: z
        .string()
        .optional()
        .describe('Model override for this turn.'),
      dangerously_skip_permissions: z
        .boolean()
        .optional()
        .describe('Auto-approve tool permissions without prompting (default: true).'),
      timeout_seconds: z
        .number()
        .optional()
        .describe('Execution timeout in seconds (default: 600).'),
    },
    async (args) => {
      try {
        const result = await executeAgyTask({
          prompt: args.prompt,
          conversationId: args.conversation_id,
          workspaceDir: args.workspace_dir,
          effort: args.effort,
          model: args.model,
          dangerouslySkipPermissions: args.dangerously_skip_permissions ?? true,
          timeoutSeconds: args.timeout_seconds ?? 600,
        });

        const formatted = formatAgyResponse(result, 'Chat Turn');
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
              text: `❌ Failed to continue Antigravity conversation (${args.conversation_id}):\n\n${err.message || String(err)}`,
            },
          ],
        };
      }
    }
  );
}
