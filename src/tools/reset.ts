import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  clearSessions,
  getActiveSessionId,
  resetActiveSession,
} from '../agy-runner.js';

export function registerResetTool(server: McpServer): void {
  server.tool(
    'agy_reset',
    'Reset the active conversation on this connection. Subsequent calls to agy_task without a session_id will start a fresh conversation with a clean context.',
    {
      clear_all_sessions: z
        .boolean()
        .optional()
        .default(false)
        .describe(
          'If true, also wipes all historical session records from the in-memory registry.'
        ),
    },
    async (args) => {
      const prevActive = getActiveSessionId();

      if (args.clear_all_sessions) {
        const count = clearSessions();
        return {
          content: [
            {
              type: 'text',
              text: `✅ Connection session reset and ${count} historical session(s) cleared. Next task will begin in a fresh conversation.`,
            },
          ],
        };
      }

      resetActiveSession();

      return {
        content: [
          {
            type: 'text',
            text: prevActive
              ? `✅ Active conversation \`${prevActive}\` detached from this connection. Next task will start fresh.`
              : '✅ Connection state is clean. Next task will start fresh.',
          },
        ],
      };
    }
  );
}
