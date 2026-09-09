import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  clearSessions,
  deleteSession,
  getActiveSessionId,
  getSession,
  listSessions,
  resolveSessionId,
  setActiveSessionId,
} from '../agy-runner.js';

export function registerSessionsTool(server: McpServer): void {
  server.tool(
    'agy_sessions',
    'List, inspect, switch, or manage multi-turn Antigravity sessions. Displays which session is currently [ACTIVE] on this connection and supports friendly session aliases.',
    {
      action: z
        .enum(['list', 'get', 'switch', 'clear', 'delete'])
        .describe(
          'Action to perform:\n- "list": List all active sessions with [ACTIVE] marker.\n- "get": Inspect a specific session by ID or alias.\n- "switch": Switch this connection\'s active session to an existing ID or alias.\n- "clear": Clear all session history.\n- "delete": Remove a specific session by ID or alias.'
        ),
      session_id: z
        .string()
        .optional()
        .describe(
          'Target session ID or alias (required for "get", "switch", and "delete").'
        ),
    },
    async (args) => {
      switch (args.action) {
        case 'list': {
          const sessions = listSessions();
          if (sessions.length === 0) {
            return {
              content: [
                {
                  type: 'text',
                  text: '### Active Antigravity Sessions\n*(No sessions recorded yet on this connection)*',
                },
              ],
            };
          }

          const lines: string[] = [
            `### Active Antigravity Sessions (${sessions.length})\n`,
            '| Status | Session ID / Alias | Title | Turns | Tokens | Last Active |',
            '| :--- | :--- | :--- | :--- | :--- | :--- |',
          ];

          for (const s of sessions) {
            const statusMark = s.isActive ? '🟢 **[ACTIVE]**' : '⚪ (idle)';
            const idDisplay = s.alias ? `\`${s.alias}\` (\`${s.id.slice(0, 8)}...\`)` : `\`${s.id}\``;
            lines.push(
              `| ${statusMark} | ${idDisplay} | ${s.title} | ${s.turns} | ${s.totalTokens} | ${s.lastActiveAt} |`
            );
          }

          lines.push(
            '\n> **Tip:** Subsequent calls to `agy_task` automatically continue the `[ACTIVE]` session. Call `agy_reset` to start fresh.'
          );

          return {
            content: [{ type: 'text', text: lines.join('\n') }],
          };
        }

        case 'get': {
          if (!args.session_id) {
            return {
              isError: true,
              content: [
                {
                  type: 'text',
                  text: 'Error: `session_id` is required when action is "get".',
                },
              ],
            };
          }

          const session = getSession(args.session_id);
          if (!session) {
            return {
              isError: true,
              content: [
                {
                  type: 'text',
                  text: `Session not found: \`${args.session_id}\``,
                },
              ],
            };
          }

          const isActive = session.id === getActiveSessionId();
          const text = [
            `### Session Details: \`${session.id}\` ${isActive ? '🟢 **[CURRENTLY ACTIVE]**' : ''}`,
            `- **Title / Task:** ${session.title}`,
            `- **Workspace:** \`${session.workspaceDir}\``,
            `- **Turns:** \`${session.turns}\``,
            `- **Tokens Used:** \`${session.totalTokens}\``,
            `- **Created:** \`${session.createdAt}\``,
            `- **Last Active:** \`${session.lastActiveAt}\``,
          ].join('\n');

          return {
            content: [{ type: 'text', text }],
          };
        }

        case 'switch': {
          if (!args.session_id) {
            return {
              isError: true,
              content: [
                {
                  type: 'text',
                  text: 'Error: `session_id` is required when action is "switch".',
                },
              ],
            };
          }

          const resolved = resolveSessionId(args.session_id);
          if (!resolved || !getSession(resolved)) {
            return {
              isError: true,
              content: [
                {
                  type: 'text',
                  text: `Cannot switch: session \`${args.session_id}\` was not found.`,
                },
              ],
            };
          }

          setActiveSessionId(resolved);
          return {
            content: [
              {
                type: 'text',
                text: `🟢 Active conversation switched to \`${args.session_id}\` (\`${resolved}\`). Subsequent \`agy_task\` calls will continue this thread.`,
              },
            ],
          };
        }

        case 'delete': {
          if (!args.session_id) {
            return {
              isError: true,
              content: [
                {
                  type: 'text',
                  text: 'Error: `session_id` is required when action is "delete".',
                },
              ],
            };
          }

          const deleted = deleteSession(args.session_id);
          return {
            content: [
              {
                type: 'text',
                text: deleted
                  ? `✅ Session \`${args.session_id}\` removed.`
                  : `Session \`${args.session_id}\` was not found in registry.`,
              },
            ],
          };
        }

        case 'clear': {
          const cleared = clearSessions();
          return {
            content: [
              {
                type: 'text',
                text: `✅ Cleared ${cleared} session(s) from registry. Connection state is clean.`,
              },
            ],
          };
        }
      }
    }
  );
}
