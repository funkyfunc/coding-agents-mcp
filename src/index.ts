#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerTaskTools } from './tools/task.js';
import { registerStatusTool } from './tools/status.js';
import { registerDiffTool } from './tools/diff.js';
import { registerSessionsTool } from './tools/sessions.js';
import { registerResetTool } from './tools/reset.js';
import { registerRunTaskTool } from './tools/run-task.js';
import { registerChatTool } from './tools/chat.js';
import { registerPlanTool } from './tools/plan.js';
import { registerListModelsTool } from './tools/list-models.js';
import { registerVersionTool } from './tools/version.js';
import { registerPrompts } from './prompts.js';
import { setupShutdownHooks, reapAllChildren } from './reaper.js';
import { registry } from './adapters/registry.js';

export function createServer(): McpServer {
  const server = new McpServer({
    name: 'coding-agents-mcp',
    version: '0.1.0',
  });

  // 1. Primary Polymorphic Multi-Agent Tools
  registerTaskTools(server);     // delegate_task, delegate_ask, agy_task, agy_ask
  registerStatusTool(server);   // agents_status (health check & model list)
  registerDiffTool(server);     // delegate_diff, agy_diff (workspace git inspection)
  registerSessionsTool(server); // delegate_sessions, agy_sessions (multi-session registry)
  registerResetTool(server);    // delegate_reset, agy_reset (connection session reset)

  // 2. Backward-Compatible Convenience Aliases
  registerRunTaskTool(server);  // agy_run_task
  registerChatTool(server);     // agy_chat
  registerPlanTool(server);     // agy_plan

  // 3. Utilities & Metadata
  registerListModelsTool(server);// agy_list_models
  registerVersionTool(server);  // agy_version

  // 4. Prompt Templates
  registerPrompts(server);

  return server;
}

async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();

  // Install process signals and stdin closure traps
  setupShutdownHooks(server);

  // Pre-flight check: report detected agents on stderr
  try {
    const statuses = await registry.getAllStatuses();
    const installed = statuses.filter((s) => s.installed).map((s) => `${s.id} (${s.version || 'installed'})`);
    process.stderr.write(
      `[coding-agents-mcp] Ready agents: ${installed.length > 0 ? installed.join(', ') : 'none detected'}\n`
    );
  } catch (err: any) {
    process.stderr.write(`[coding-agents-mcp] Agent discovery notice: ${err.message}\n`);
  }

  await server.connect(transport);
  process.stderr.write(
    '[coding-agents-mcp] Server running on stdio transport with active process reaping.\n'
  );
}

// Only run main if called directly as CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    process.stderr.write(`[coding-agents-mcp] Fatal error: ${err.stack || err}\n`);
    reapAllChildren('Fatal startup error');
    process.exit(1);
  });
}
