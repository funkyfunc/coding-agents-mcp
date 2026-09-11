import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { pipelineEngine, PipelineOptions } from '../pipeline.js';

export function registerPipelineTool(server: McpServer): void {
  server.tool(
    'delegate_pipeline',
    'Execute a multi-agent orchestration pipeline (e.g. Architect + Builder, Peer Review, Custom DAG). Automates planning, implementation, and verification across agents in an isolated git worktree.',
    {
      pipeline_name: z
        .string()
        .describe('Friendly identifier for this pipeline run (e.g., "auth-refactor", "api-migration").'),
      topology: z
        .enum(['architect_builder', 'peer_review', 'custom'])
        .optional()
        .default('architect_builder')
        .describe(
          'Workflow topology:\n- "architect_builder" (default): Claude (plan) designs spec -> Antigravity (edit) implements in worktree -> Claude (explain) verifies diff.\n- "peer_review": Author agent edits -> Reviewer agent critiques diff.\n- "custom": User-defined stages array.'
        ),
      prompt: z
        .string()
        .describe('Global task instruction or objective for the entire pipeline.'),
      workspace_dir: z
        .string()
        .optional()
        .describe('Target repository directory (defaults to current working directory).'),
      isolate_worktree: z
        .boolean()
        .optional()
        .default(true)
        .describe('Execute pipeline inside an isolated ephemeral git worktree to avoid collisions (default: true).'),
      auto_rollback_on_failure: z
        .boolean()
        .optional()
        .default(true)
        .describe('Automatically delete the ephemeral worktree and branch if any pipeline stage fails (default: true).'),
      custom_stages: z
        .array(
          z.object({
            id: z.string(),
            agent: z.enum(['auto', 'claude', 'agy', 'codex', 'cursor']),
            mode: z.enum(['plan', 'edit', 'explain']),
            model: z.string().optional(),
            thinking: z.string().optional(),
            prompt_template: z.string().describe('Prompt template with optional {{stages.id.output}} or {{current_diff}} placeholders.'),
          })
        )
        .optional()
        .describe('Custom stages list (required when topology is "custom").'),
    },
    async (args) => {
      try {
        const options: PipelineOptions = {
          pipelineName: args.pipeline_name,
          topology: args.topology,
          prompt: args.prompt,
          workspaceDir: args.workspace_dir,
          isolateWorktree: args.isolate_worktree,
          autoRollbackOnFailure: args.auto_rollback_on_failure,
          customStages: args.custom_stages?.map((s) => ({
            id: s.id,
            agent: s.agent as any,
            mode: s.mode,
            model: s.model,
            thinking: s.thinking,
            promptTemplate: s.prompt_template,
          })),
        };

        const result = await pipelineEngine.execute(options);

        const parts: string[] = [
          `## 🚀 Pipeline Run: \`${result.pipelineName}\` [Topology: \`${result.topology}\`]`,
          `- **Overall Status:** \`${result.success ? 'SUCCESS' : 'FAILED'}\``,
          `- **Duration:** \`${(result.totalDurationMs / 1000).toFixed(2)}s\``,
        ];

        if (result.worktree) {
          parts.push(
            `- **Isolated Worktree:** \`${result.worktree.worktreePath}\` (Branch: \`${result.worktree.branchName}\`)`,
            `  *(To merge: call \`delegate_worktree\` with action "merge" and alias "${result.worktree.alias}")*`
          );
        }

        if (result.finalDiffSummary) {
          parts.push(`- **Final Changes:** \`${result.finalDiffSummary}\``);
        }

        if (result.error) {
          parts.push(`\n⚠️ **Pipeline Failure Notice:** ${result.error}`);
        }

        parts.push('\n### 📋 Stage Execution Breakdown');
        for (const stage of result.stages) {
          const statusIcon = stage.success ? '✅' : '❌';
          parts.push(
            `\n#### ${statusIcon} Stage: \`${stage.id}\` (${stage.agent.toUpperCase()} - \`${stage.mode}\`)`,
            `- **Duration:** \`${(stage.durationMs / 1000).toFixed(2)}s\`${stage.modelUsed ? ` | **Model:** \`${stage.modelUsed}\`` : ''}`
          );

          if (stage.output) {
            const preview = stage.output.length > 800 ? `${stage.output.slice(0, 800)}\n\n*(output truncated in pipeline summary)*` : stage.output;
            parts.push(`\n${preview}`);
          }
          if (stage.error) {
            parts.push(`\n> ⚠️ Error: ${stage.error}`);
          }
        }

        return {
          content: [{ type: 'text', text: parts.join('\n') }],
          isError: !result.success,
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `⚠️ **Pipeline Execution Error:** ${err.message}` }],
        };
      }
    }
  );
}
