import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { listAllSessions, setActiveSession, resetSession } from '../session-store.js';
import { AgentId } from '../adapters/types.js';

export function registerSessionsTool(server: McpServer): void {
  const handler = async (args: {
    action: 'list' | 'switch' | 'clear';
    session_id?: string;
    agent?: string;
  }) => {
    switch (args.action) {
      case 'list': {
        const sessions = listAllSessions();
        if (sessions.length === 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: '### Active Agent Sessions\n*(No sessions recorded yet on this connection)*',
              },
            ],
          };
        }

        const lines: string[] = [
          `### Active Agent Sessions (${sessions.length})\n`,
          '| Status | Agent | Session ID / Alias | Title | Turns | Tokens | Last Active |',
          '| :--- | :--- | :--- | :--- | :--- | :--- | :--- |',
        ];

        for (const s of sessions) {
          const statusMark = s.isActive ? '🟢 **[ACTIVE]**' : '⚪ (idle)';
          const idDisplay = s.alias
            ? `\`${s.alias}\` (\`${s.sessionId.slice(0, 8)}...\`)`
            : `\`${s.sessionId}\``;
          lines.push(
            `| ${statusMark} | **${s.agent.toUpperCase()}** | ${idDisplay} | ${s.title || '—'} | ${s.turns} | ${s.tokens} | ${s.lastActive} |`
          );
        }

        lines.push(
          '\n> **Tip:** Subsequent calls to `delegate_task` automatically continue the `[ACTIVE]` session for that agent. Call `delegate_reset` to start fresh.'
        );

        return {
          content: [
            {
              type: 'text' as const,
              text: lines.join('\n'),
            },
          ],
        };
      }

      case 'switch': {
        if (!args.session_id) {
          return {
            content: [
              {
                type: 'text' as const,
                text: 'Error: `session_id` argument is required for switch action.',
              },
            ],
            isError: true,
          };
        }

        const sessions = listAllSessions();
        const found = sessions.find(
          (s) =>
            s.sessionId.toLowerCase() === args.session_id!.toLowerCase() ||
            (s.alias && s.alias.toLowerCase() === args.session_id!.toLowerCase())
        );

        if (!found) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Session "${args.session_id}" not found. Call \`delegate_sessions\` with action "list" to see known sessions.`,
              },
            ],
            isError: true,
          };
        }

        setActiveSession(found.agent, found.sessionId, found.alias);
        return {
          content: [
            {
              type: 'text' as const,
              text: `✅ Switched active ${found.agent.toUpperCase()} session to \`${found.sessionId}\`${found.alias ? ` [Alias: "${found.alias}"]` : ''}.`,
            },
          ],
        };
      }

      case 'clear': {
        const targetAgent = args.agent ? (args.agent as AgentId) : undefined;
        const res = resetSession(targetAgent);
        return {
          content: [
            {
              type: 'text' as const,
              text: `✅ Cleared ${res.resetCount} active session(s). Next task will start fresh.`,
            },
          ],
        };
      }
    }
  };

  // Primary universal tool
  server.tool(
    'delegate_sessions',
    'List, inspect, or switch multi-turn agent sessions. Shows which sessions are currently [ACTIVE] across backends.',
    {
      action: z
        .enum(['list', 'switch', 'clear'])
        .describe(
          'Action to perform:\n- "list": List all active sessions with [ACTIVE] markers.\n- "switch": Switch the active session for an agent.\n- "clear": Reset active session(s).'
        ),
      session_id: z
        .string()
        .optional()
        .describe('Target session ID or alias (required for "switch").'),
      agent: z
        .enum(['auto', 'claude', 'agy', 'codex', 'cursor'])
        .optional()
        .describe('Target agent backend.'),
    },
    async (args) => {
      return handler(args);
    }
  );

  // Backward-compatibility alias
  server.tool(
    'agy_sessions',
    '[Legacy Alias -> delegate_sessions] Manage Antigravity sessions.',
    {
      action: z.enum(['list', 'switch', 'clear']),
      session_id: z.string().optional(),
    },
    async (args) => {
      return handler({ ...args, agent: 'agy' });
    }
  );
}
