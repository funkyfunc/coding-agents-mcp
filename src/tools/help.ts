import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { findAgyBinary } from '../agy-runner.js';
import { registry } from '../adapters/registry.js';
import { AgentId } from '../adapters/types.js';

const execFileAsync = promisify(execFile);

export function registerHelpTool(server: McpServer): void {
  server.tool(
    'agent_help',
    'Introspect the live, version-accurate CLI help documentation and flags of an installed coding agent (Claude Code, Antigravity, Cursor, Codex). Use to discover new upstream features and pass them via raw_args.',
    {
      agent: z
        .enum(['claude', 'agy', 'codex', 'cursor'])
        .describe('Target CLI agent to inspect help output for.'),
      subtopic: z
        .string()
        .optional()
        .describe('Optional subcommand or subtopic (e.g. "mcp", "doctor", "plugin").'),
    },
    async (args) => {
      try {
        const adapter = await registry.resolve(args.agent as AgentId);
        const isAvailable = await adapter.isAvailable();

        if (!isAvailable) {
          const status = await adapter.getStatus();
          return {
            content: [
              {
                type: 'text',
                text: `⚠️ **Agent Not Installed:** \`${args.agent.toUpperCase()}\`.\n\n${status.notes || 'Please install the CLI to introspect its live help commands.'}`,
              },
            ],
            isError: true,
          };
        }

        let binary = args.agent === 'agy' ? findAgyBinary() : args.agent;
        if (args.agent === 'claude') {
          try {
            const whichRes = await execFileAsync('which', ['claude']);
            binary = whichRes.stdout.trim().split('\n')[0];
          } catch {
            binary = 'claude';
          }
        }

        const cmdArgs: string[] = [];
        if (args.subtopic) {
          cmdArgs.push(args.subtopic);
        }
        cmdArgs.push('--help');

        const execRes = await execFileAsync(binary, cmdArgs, {
          timeout: 8000,
          env: {
            ...process.env,
            FORCE_COLOR: '0',
          },
        });

        const output = (execRes.stdout || execRes.stderr || '').trim();

        const lines = [
          `### 📖 Live CLI Help: \`${args.agent.toUpperCase()}\``,
          `- **Binary Path:** \`${binary}\``,
          `- **Introspection Command:** \`${binary} ${cmdArgs.join(' ')}\``,
          '',
          '```text',
          output,
          '```',
          '',
          '> **💡 How to Use Discovered Flags:**',
          `> You can pass any discovered flags directly into \`delegate_task\` or \`delegate_ask\` via \`raw_args: ["--your-flag"]\`.`,
          `> The command will execute inside the managed hypervisor with full worktree sandboxing, session memory, and process safety.`,
        ];

        return {
          content: [
            {
              type: 'text',
              text: lines.join('\n'),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [
            {
              type: 'text',
              text: `⚠️ **Failed to introspect help for \`${args.agent}\`:** ${err.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
