import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { worktreeManager } from '../worktree.js';

export function registerWorktreeTool(server: McpServer): void {
  server.tool(
    'delegate_worktree',
    'Manage isolated git worktrees for autonomous agents. Inspect, merge, or discard agent worktrees without polluting or locking the main working tree.',
    {
      action: z
        .enum(['list', 'inspect', 'merge', 'discard'])
        .describe(
          'Action to perform:\n- "list": Show all currently active agent worktrees.\n- "inspect": Inspect modified files and diff in a worktree.\n- "merge": Merge worktree changes into the primary repository branch.\n- "discard": Forcefully remove a worktree and its temporary branch.'
        ),
      alias: z
        .string()
        .optional()
        .describe('Worktree alias name (required for inspect, merge, and discard).'),
      commit_message: z
        .string()
        .optional()
        .describe('Commit message when merging worktree changes.'),
      squash: z
        .boolean()
        .optional()
        .default(true)
        .describe('Squash commits during merge (default: true).'),
    },
    async (args) => {
      try {
        switch (args.action) {
          case 'list': {
            const worktrees = worktreeManager.listWorktrees();
            if (worktrees.length === 0) {
              return {
                content: [
                  {
                    type: 'text',
                    text: '### 🌳 Active Agent Worktrees\n*(No active ephemeral worktrees currently registered)*',
                  },
                ],
              };
            }

            const rows = [
              '### 🌳 Active Agent Worktrees\n',
              '| Alias | Branch | Path | Created |',
              '| :--- | :--- | :--- | :--- |',
            ];

            for (const wt of worktrees) {
              const dateStr = new Date(wt.createdAt).toISOString();
              rows.push(
                `| \`${wt.alias}\` | \`${wt.branchName}\` | \`${wt.worktreePath}\` | ${dateStr} |`
              );
            }

            return {
              content: [{ type: 'text', text: rows.join('\n') }],
            };
          }

          case 'inspect': {
            if (!args.alias) {
              return {
                isError: true,
                content: [{ type: 'text', text: 'Error: "alias" parameter is required for inspect action.' }],
              };
            }

            const diff = await worktreeManager.inspectWorktree(args.alias);
            const lines = [
              `### 🔍 Worktree Inspection: \`${args.alias}\``,
              `- **Branch:** \`${diff.branchName || 'unknown'}\``,
              `- **Path:** \`${diff.worktreePath || 'unknown'}\``,
              `- **Stats:** \`+${diff.insertions}\` insertions, \`-${diff.deletions}\` deletions`,
              `- **Modified Files (${diff.filesChanged.length}):**`,
            ];

            if (diff.filesChanged.length === 0) {
              lines.push('  *(Clean working tree: no modifications)*');
            } else {
              for (const file of diff.filesChanged) {
                lines.push(`  - \`${file}\``);
              }
            }

            if (diff.patch && diff.patch.trim().length > 0) {
              lines.push('\n### Unified Diff Patch\n```diff');
              lines.push(diff.patch);
              lines.push('```');
            }

            return {
              content: [{ type: 'text', text: lines.join('\n') }],
            };
          }

          case 'merge': {
            if (!args.alias) {
              return {
                isError: true,
                content: [{ type: 'text', text: 'Error: "alias" parameter is required for merge action.' }],
              };
            }

            const mergeRes = await worktreeManager.mergeWorktree(args.alias, {
              squash: args.squash,
              commitMessage: args.commit_message,
            });

            return {
              content: [
                {
                  type: 'text',
                  text: `✅ Successfully merged worktree \`${args.alias}\` into base repository.\n- **Files Merged:** ${mergeRes.filesChanged.length}\n- **Commit:** \`${mergeRes.commitSha || 'uncommitted'}\``,
                },
              ],
            };
          }

          case 'discard': {
            if (!args.alias) {
              return {
                isError: true,
                content: [{ type: 'text', text: 'Error: "alias" parameter is required for discard action.' }],
              };
            }

            await worktreeManager.removeWorktree(args.alias, true);
            return {
              content: [
                {
                  type: 'text',
                  text: `🗑️ Successfully removed ephemeral worktree \`${args.alias}\` and deleted its branch.`,
                },
              ],
            };
          }
        }
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `⚠️ **Worktree Error:** ${err.message}` }],
        };
      }
    }
  );
}
