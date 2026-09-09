import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getAgyVersion } from '../agy-runner.js';

export function registerVersionTool(server: McpServer): void {
  server.tool(
    'agy_version',
    'Get the version and binary path of the installed Google Antigravity (agy) CLI, verifying runtime health.',
    {},
    async () => {
      try {
        const info = await getAgyVersion();
        const text = [
          '### Antigravity Runtime Status',
          `- **CLI Version:** \`${info.version}\``,
          `- **Binary Path:** \`${info.binaryPath}\``,
          `- **Node Runtime:** \`${process.version}\``,
          `- **Status:** ✅ Operational`,
        ].join('\n');

        return {
          content: [
            {
              type: 'text',
              text,
            },
          ],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `❌ Antigravity CLI check failed:\n\n${err.message || String(err)}`,
            },
          ],
        };
      }
    }
  );
}
