import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as path from 'node:path';
import { inspectGitWorkspace } from '../git.js';

export function registerDiffTool(server: McpServer): void {
  const handler = async (args: { workspace_dir?: string }) => {
    const cwd = args.workspace_dir
      ? path.resolve(args.workspace_dir)
      : process.cwd();

    const diffResult = await inspectGitWorkspace(cwd);

    const parts: string[] = ['### 🔍 Workspace Git Diff & Status'];
    parts.push(`- **Directory:** \`${cwd}\``);
    parts.push(`- **Is Git Repository:** \`${diffResult.isGitRepo}\``);

    if (diffResult.branch) {
      parts.push(`- **Current Branch:** \`${diffResult.branch}\``);
    }

    parts.push(
      `- **Stats:** \`+${diffResult.insertions}\` insertions, \`-${diffResult.deletions}\` deletions`
    );

    parts.push(`- **Modified Files (${diffResult.filesChanged.length}):**`);
    if (diffResult.filesChanged.length === 0) {
      parts.push('  *(Clean working tree: no uncommitted modifications)*');
    } else {
      for (const file of diffResult.filesChanged) {
        parts.push(`  - \`${file}\``);
      }
    }

    if (diffResult.patch && diffResult.patch.trim().length > 0) {
      parts.push('\n### Unified Diff Patch');
      parts.push('```diff');
      parts.push(diffResult.patch);
      parts.push('```');
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: parts.join('\n'),
        },
      ],
    };
  };

  // Primary universal tool
  server.tool(
    'delegate_diff',
    'Inspect the current git status, modified files, insertions/deletions, and unified diff patch in the target workspace non-destructively.',
    {
      workspace_dir: z
        .string()
        .optional()
        .describe('Workspace directory to inspect (defaults to current working directory).'),
    },
    async (args) => {
      return handler(args);
    }
  );

  // Backward-compatibility alias
  server.tool(
    'agy_diff',
    '[Legacy Alias -> delegate_diff] Inspect git status and diff patch in the target workspace.',
    {
      workspace_dir: z.string().optional(),
    },
    async (args) => {
      return handler(args);
    }
  );
}
