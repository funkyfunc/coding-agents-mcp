#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerTaskTools } from './tools/task.js';
import { registerDiffTool } from './tools/diff.js';
import { registerSessionsTool } from './tools/sessions.js';
import { registerResetTool } from './tools/reset.js';
import { registerRunTaskTool } from './tools/run-task.js';
import { registerChatTool } from './tools/chat.js';
import { registerPlanTool } from './tools/plan.js';
import { registerListModelsTool } from './tools/list-models.js';
import { registerVersionTool } from './tools/version.js';
import { registerPrompts } from './prompts.js';
import { findAgyBinary, reapAllChildren } from './agy-runner.js';

export function createServer(): McpServer {
  const server = new McpServer({
    name: 'agy-mcp',
    version: '1.2.0',
  });

  // Primary Agent-First Tools
  registerTaskTools(server);     // agy_task (smart stateful workhorse), agy_ask (one-off)
  registerDiffTool(server);      // agy_diff (workspace inspection)
  registerSessionsTool(server);  // agy_sessions (multi-session registry & switcher)
  registerResetTool(server);     // agy_reset (connection session reset)

  // Backward-Compatible Convenience Aliases
  registerRunTaskTool(server);   // agy_run_task
  registerChatTool(server);      // agy_chat
  registerPlanTool(server);      // agy_plan

  // Utilities & Metadata
  registerListModelsTool(server);// agy_list_models
  registerVersionTool(server);   // agy_version

  // Prompt Templates
  registerPrompts(server);

  return server;
}

async function main(): Promise<void> {
  // Pre-flight check: verify agy binary exists or warn via stderr
  try {
    const binary = findAgyBinary();
    process.stderr.write(`[agy-mcp] Found Antigravity CLI at: ${binary}\n`);
  } catch (err: any) {
    process.stderr.write(
      `[agy-mcp] Warning: ${err.message}. Tools will report an error if invoked before agy is available.\n`
    );
  }

  const server = createServer();
  const transport = new StdioServerTransport();

  let isExiting = false;
  const gracefulShutdown = async (reason: string, code = 0) => {
    if (isExiting) return;
    isExiting = true;
    process.stderr.write(`[agy-mcp] Shutting down (${reason})...\n`);
    reapAllChildren(reason);
    try {
      await server.close();
    } catch {}
    process.exit(code);
  };

  // 1. Trap parent process disconnects via stdin closure
  process.stdin.on('close', () => {
    gracefulShutdown('Parent closed stdin pipe');
  });

  process.stdin.on('end', () => {
    gracefulShutdown('Parent ended stdin stream');
  });

  // 2. Standard process termination signals
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGHUP', () => gracefulShutdown('SIGHUP (terminal closed)'));

  // 3. Process exit fallback hook
  process.on('exit', () => {
    reapAllChildren('Process exit');
  });

  process.on('uncaughtException', (err) => {
    process.stderr.write(`[agy-mcp] Uncaught exception: ${err.stack || err}\n`);
    gracefulShutdown('Uncaught exception', 1);
  });

  process.on('unhandledRejection', (reason) => {
    process.stderr.write(`[agy-mcp] Unhandled rejection: ${reason}\n`);
  });

  await server.connect(transport);
  process.stderr.write(
    '[agy-mcp] Server running on stdio transport with active process reaping.\n'
  );
}

// Only run main if called directly as CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    process.stderr.write(`[agy-mcp] Fatal error: ${err.stack || err}\n`);
    reapAllChildren('Fatal startup error');
    process.exit(1);
  });
}
