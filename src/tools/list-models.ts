import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { listAgyModels } from '../agy-runner.js';

export function registerListModelsTool(server: McpServer): void {
  server.tool(
    'agy_list_models',
    'List all AI models available to the Antigravity CLI runtime (e.g., Gemini 3.8 Flash, Gemini 3.1 Pro, Claude Sonnet 4.6, Claude Opus 4.6).',
    {},
    async () => {
      try {
        const models = await listAgyModels();
        const lines: string[] = ['### Available Antigravity Models', ''];
        lines.push('| Model ID | Display Name |');
        lines.push('| :--- | :--- |');

        for (const m of models) {
          lines.push(`| \`${m.id}\` | ${m.name} |`);
        }

        lines.push('');
        lines.push(
          '> **Tip:** Pass any Model ID into the `model` parameter of `agy_run_task`, `agy_plan`, or `agy_chat`.'
        );

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
          isError: true,
          content: [
            {
              type: 'text',
              text: `❌ Failed to list Antigravity models:\n\n${err.message || String(err)}`,
            },
          ],
        };
      }
    }
  );
}
