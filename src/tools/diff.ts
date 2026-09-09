import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as path from 'node:path';
import { getWorkspaceGitDiff } from '../agy-runner.js';

export function registerDiffTool(server: McpServer): void {
  server.tool(
    'agy_diff',
    'Inspect the current git status and diff patch in the target workspace. Shows modified files and code changes made by Antigravity or local edits.',
    {
      workspace_dir: z
        .string()
        .optional()
        .describe(
          'Workspace directory to inspect (defaults to current working directory).'
        ),
      staged: z
        .boolean()
        .optional()
        .default(false)
        .describe(
          'If true, inspects staged changes (git diff --cached); otherwise unstaged/working tree changes.'
        ),
    },
    async (args) => {
      const cwd = args.workspace_dir
        ? path.resolve(args.workspace_dir)
        : process.cwd();

      const { modifiedFiles, diff } = getWorkspaceGitDiff(cwd, args.staged);

      const parts: string[] = ['### 🔍 Workspace Git Inspection'];
      parts.push(`- **Directory:** \`${cwd}\``);
      parts.push(`- **Target:** \`${args.staged ? 'Staged Changes' : 'Working Tree'}\``);
      parts.push(`- **Modified Files (${modifiedFiles.length}):**`);

      if (modifiedFiles.length === 0) {
        parts.push('  *(Clean working tree: no modified or untracked files)*');
      } else {
        for (const file of modifiedFiles) {
          parts.push(`  - \`${file}\``);
        }
      }

      if (diff.trim().length > 0) {
        parts.push('\n### Unified Diff Patch');
        parts.push('```diff');
        parts.push(diff);
        parts.push('```');
      }

      return {
        content: [
          {
            type: 'text',
            text: parts.join('\n'),
          },
        ],
      };
    }
  );
}
