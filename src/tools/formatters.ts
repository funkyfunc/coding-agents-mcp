import { getSessionAlias } from '../agy-runner.js';
import { AgyExecutionResult } from '../types.js';

export function formatAgyResponse(
  result: AgyExecutionResult,
  actionTitle = 'Task Execution'
): string {
  const parts: string[] = [];

  // Main response content
  if (result.response && result.response.trim()) {
    parts.push(result.response.trim());
  } else if (result.error) {
    parts.push(`⚠️ **Error during execution:** ${result.error}`);
  } else {
    parts.push('*(No text response returned by Antigravity)*');
  }

  // Modified files list (if detected via git)
  if (result.modifiedFiles && result.modifiedFiles.length > 0) {
    parts.push('\n\n### 📁 Modified Workspace Files');
    for (const f of result.modifiedFiles) {
      parts.push(`- \`${f}\``);
    }
  }

  // Git diff patch (if captured)
  if (result.gitDiff && result.gitDiff.trim().length > 0) {
    parts.push('\n\n### 🔍 Git Diff Patch');
    parts.push('```diff');
    if (result.gitDiff.length > 5000) {
      parts.push(result.gitDiff.slice(0, 5000));
      parts.push('\n... (diff truncated, use agy_diff for complete patch)');
    } else {
      parts.push(result.gitDiff);
    }
    parts.push('```');
  }

  parts.push('\n\n---');

  // Metadata block
  parts.push(`### 🤖 Antigravity ${actionTitle} Summary`);
  parts.push(`- **Status:** \`${result.status}\``);

  if (result.isOneOff) {
    parts.push(`- **Session Mode:** \`One-off (Stateless)\``);
  } else {
    const alias = result.conversationId ? getSessionAlias(result.conversationId) : undefined;
    const aliasText = alias ? ` [Alias: "${alias}"]` : '';
    parts.push(
      `- **Active Session:** \`${result.conversationId}\`${aliasText} *(auto-maintained on this connection; call \`agy_reset\` to start fresh)*`
    );
  }

  parts.push(
    `- **Duration:** \`${result.durationSeconds.toFixed(2)}s\` | **Turns:** \`${result.numTurns}\``
  );

  if (result.usage) {
    const total = result.usage.total_tokens ?? 0;
    const input = result.usage.input_tokens ?? 0;
    const output = result.usage.output_tokens ?? 0;
    const thinking = result.usage.thinking_tokens ?? 0;
    const cacheRead = result.usage.cache_read_tokens ?? 0;

    parts.push(
      `- **Tokens:** Total: \`${total}\` (Input: \`${input}\`, Output: \`${output}\`, Thinking: \`${thinking}\`, Cache: \`${cacheRead}\`)`
    );
  }

  // Tool execution summary
  const toolSteps = result.steps.filter(
    (s) => s.stepType === 'tool' && s.toolName
  );

  if (toolSteps.length > 0) {
    parts.push(`- **Tools Executed (${toolSteps.length}):**`);
    for (const step of toolSteps) {
      const tool = step.toolName;
      let detail = '';
      if (step.toolParameters) {
        if (step.toolParameters.CommandLine) {
          detail = `\`${step.toolParameters.CommandLine}\``;
        } else if (step.toolParameters.TargetFile) {
          detail = `\`${step.toolParameters.TargetFile}\``;
        } else if (step.toolParameters.AbsolutePath) {
          detail = `\`${step.toolParameters.AbsolutePath}\``;
        } else if (step.toolParameters.DirectoryPath) {
          detail = `\`${step.toolParameters.DirectoryPath}\``;
        } else if (step.toolParameters.Query) {
          detail = `\`${step.toolParameters.Query}\``;
        }
      }
      parts.push(`  - \`${tool}\` ${detail} (${step.state})`);
    }
  }

  return parts.join('\n');
}
