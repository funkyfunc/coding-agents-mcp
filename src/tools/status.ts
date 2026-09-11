import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registry } from '../adapters/registry.js';

export function registerStatusTool(server: McpServer): void {
  server.tool(
    'agents_status',
    'Inspect the status of all supported CLI coding agents (Claude Code, Antigravity, Codex, Cursor). Reports installed versions, paths, default models, and available thinking levels.',
    {},
    async () => {
      try {
        const statuses = await registry.getAllStatuses();

        const rows: string[] = [];
        rows.push('| Status | Agent | Version | Default Model | Available Models | Thinking Levels |');
        rows.push('| :--- | :--- | :--- | :--- | :--- | :--- |');

        for (const s of statuses) {
          const statusIcon = s.installed ? '🟢 **Ready**' : '⚪ (Not Installed)';
          const version = s.version ? `\`${s.version}\`` : '—';
          const defaultModel = `\`${s.defaultModel}\``;
          const models = s.models.map((m) => `\`${m}\``).join(', ');
          const thinking = s.thinkingLevels.length > 0
            ? s.thinkingLevels.map((t) => `\`${t}\``).join(', ')
            : '—';

          rows.push(
            `| ${statusIcon} | **${s.name}** (\`${s.id}\`) | ${version} | ${defaultModel} | ${models} | ${thinking} |`
          );
        }

        const notes: string[] = [];
        for (const s of statuses) {
          if (s.notes) {
            notes.push(`- **${s.name}**: ${s.notes}`);
          }
        }

        const capRows: string[] = [];
        capRows.push('| Agent | Modes | Worktree Isolation | Reasoning / Thinking | Sandbox | Custom Skills |');
        capRows.push('| :--- | :--- | :--- | :--- | :--- | :--- |');

        for (const s of statuses) {
          if (s.capabilities) {
            const c = s.capabilities;
            const modes = c.modes.join(', ');
            const wt = c.supportsWorktreeIsolation ? '✅ Supported' : '❌';
            const th = c.supportsThinking ? `✅ (${c.thinkingLevels.join(', ')})` : '❌';
            const sb = c.supportsSandbox ? '✅ Supported' : '❌';
            const sk = c.supportsCustomSkills ? '✅ Supported' : '❌';
            capRows.push(`| **${s.name}** | \`${modes}\` | ${wt} | ${th} | ${sb} | ${sk} |`);
          }
        }

        const mdParts = [
          '## 🤖 Supported CLI Coding Agents Status',
          '',
          rows.join('\n'),
        ];

        if (capRows.length > 2) {
          mdParts.push('', '### ⚡ Deep Capabilities Matrix', '', capRows.join('\n'));
        }

        mdParts.push(
          '',
          '### Notes & Installation',
          notes.join('\n'),
          '',
          '> **Tip:** When calling `delegate_task` or `delegate_ask`, pass `agent: "auto"` to automatically route to the best available installed backend.'
        );

        const md = mdParts.join('\n');

        return {
          content: [
            {
              type: 'text',
              text: md,
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [
            {
              type: 'text',
              text: `Error inspecting agent statuses: ${err.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
