import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { resetSession, getActiveSession } from '../session-store.js';
import { AgentId } from '../adapters/types.js';

export function registerResetTool(server: McpServer): void {
  // Primary universal tool
  server.tool(
    'delegate_reset',
    'Reset the active conversation session for a specific agent backend, or for all agents on this connection. Subsequent tasks will begin with a fresh conversation and clean context.',
    {
      agent: z
        .enum(['auto', 'claude', 'agy', 'codex', 'cursor'])
        .optional()
        .describe(
          'Specific agent to reset (e.g. "claude", "agy"). If omitted, resets active conversations across all agents.'
        ),
    },
    async (args) => {
      const targetAgent = args.agent ? (args.agent as AgentId) : undefined;
      const res = resetSession(targetAgent);

      const agentList = res.agents.length > 0 ? res.agents.join(', ') : 'all';
      return {
        content: [
          {
            type: 'text',
            text: `✅ Reset ${res.resetCount} active conversation session(s) (${agentList}). Next task will start fresh with clean context.`,
          },
        ],
      };
    }
  );

  // Backward-compatibility alias
  server.tool(
    'agy_reset',
    '[Legacy Alias -> delegate_reset(agent="agy")] Reset the active conversation with Google Antigravity on this connection.',
    {
      clear_all_sessions: z.boolean().optional().default(false),
    },
    async () => {
      const prevActive = getActiveSession('agy');
      resetSession('agy');

      return {
        content: [
          {
            type: 'text',
            text: prevActive
              ? `✅ Active Antigravity conversation \`${prevActive}\` detached from this connection. Next task will start fresh.`
              : '✅ Antigravity connection state is clean. Next task will start fresh.',
          },
        ],
      };
    }
  );
}
