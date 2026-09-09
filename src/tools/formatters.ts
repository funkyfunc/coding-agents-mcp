import { AgentTaskResult } from '../adapters/types.js';

/**
 * Format any agent task result into a clean, markdown response with metadata footer.
 */
export function formatAgentResponse(
  result: AgentTaskResult,
  actionTitle = 'Task Execution'
): string {
  const parts: string[] = [];

  // Main output content
  if (result.output && result.output.trim()) {
    parts.push(result.output.trim());
  } else if (result.error) {
    parts.push(`⚠️ **Error during execution:** ${result.error}`);
  } else {
    parts.push('*(No text response returned by agent)*');
  }

  // Modified files list (if detected via git)
  if (result.diff && result.diff.filesChanged.length > 0) {
    parts.push('\n\n### 📁 Modified Workspace Files');
    for (const f of result.diff.filesChanged) {
      parts.push(`- \`${f}\``);
    }
  }

  // Git diff patch (if captured)
  if (result.diff?.patch && result.diff.patch.trim().length > 0) {
    parts.push('\n\n### 🔍 Git Diff Patch');
    parts.push('```diff');
    if (result.diff.patch.length > 5000) {
      parts.push(result.diff.patch.slice(0, 5000));
      parts.push('\n... (diff truncated, call delegate_diff for complete patch)');
    } else {
      parts.push(result.diff.patch);
    }
    parts.push('```');
  }

  parts.push('\n\n---');

  // Metadata block
  const agentDisplayName =
    result.agent === 'claude'
      ? 'Claude Code'
      : result.agent === 'agy'
        ? 'Antigravity'
        : result.agent.toUpperCase();

  parts.push(`### 🤖 ${agentDisplayName} ${actionTitle} Summary`);
  parts.push(`- **Status:** \`${result.success ? 'SUCCESS' : 'FAILED'}\``);
  if (result.modelUsed) {
    parts.push(`- **Model:** \`${result.modelUsed}\``);
  }

  if (result.isOneOff || !result.sessionId) {
    parts.push(`- **Session Mode:** \`One-off (Stateless)\``);
  } else {
    const aliasText = result.sessionAlias ? ` [Alias: "${result.sessionAlias}"]` : '';
    parts.push(
      `- **Active Session:** \`${result.sessionId}\`${aliasText} *(auto-maintained on this connection; call \`delegate_reset\` to start fresh)*`
    );
  }

  const durationSec = (result.durationMs / 1000).toFixed(2);
  const turns = result.turns ?? 1;
  parts.push(`- **Duration:** \`${durationSec}s\` | **Turns:** \`${turns}\``);

  if (result.costUsd !== undefined) {
    parts.push(`- **Cost:** \`$${result.costUsd.toFixed(4)}\``);
  }

  if (result.tokens) {
    const total = result.tokens.total ?? 0;
    const input = result.tokens.input ?? 0;
    const output = result.tokens.output ?? 0;
    const thinking = result.tokens.thinking ?? 0;
    const cache = result.tokens.cache ?? 0;

    parts.push(
      `- **Tokens:** Total: \`${total}\` (Input: \`${input}\`, Output: \`${output}\`, Thinking: \`${thinking}\`, Cache: \`${cache}\`)`
    );
  }

  // Tool execution summary
  if (result.toolsUsed && result.toolsUsed.length > 0) {
    parts.push(`- **Tools Executed (${result.toolsUsed.length}):**`);
    for (const tool of result.toolsUsed) {
      const detail = tool.target ? ` \`${tool.target}\`` : '';
      parts.push(`  - \`${tool.name}\`${detail} (${tool.status})`);
    }
  }

  return parts.join('\n');
}

/**
 * Backward-compatible helper for legacy agy response formatting.
 */
export function formatAgyResponse(result: any, actionTitle = 'Task Execution'): string {
  // If result is already an AgentTaskResult
  if ('durationMs' in result) {
    return formatAgentResponse(result, actionTitle);
  }

  // Map legacy AgyExecutionResult to AgentTaskResult
  const mapped: AgentTaskResult = {
    success: result.status === 'SUCCESS',
    agent: 'agy',
    output: result.response || '',
    error: result.error,
    sessionId: result.conversationId,
    durationMs: (result.durationSeconds || 0) * 1000,
    turns: result.numTurns,
    tokens: result.usage
      ? {
          total: result.usage.total_tokens,
          input: result.usage.input_tokens,
          output: result.usage.output_tokens,
          thinking: result.usage.thinking_tokens,
          cache: result.usage.cache_read_tokens,
        }
      : undefined,
  };

  return formatAgentResponse(mapped, actionTitle);
}
