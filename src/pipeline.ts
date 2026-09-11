import { registry } from './adapters/registry.js';
import { AgentId, AgentTaskResult } from './adapters/types.js';
import { worktreeManager, WorktreeInstance } from './worktree.js';
import { inspectGitWorkspace } from './git.js';

export interface PipelineStageConfig {
  id: string;
  agent: AgentId;
  mode: 'plan' | 'edit' | 'explain';
  model?: string;
  thinking?: string;
  promptTemplate: string;
  dependsOn?: string[];
}

export interface PipelineOptions {
  pipelineName: string;
  topology?: 'architect_builder' | 'peer_review' | 'custom';
  prompt: string;
  workspaceDir?: string;
  isolateWorktree?: boolean;
  autoRollbackOnFailure?: boolean;
  customStages?: PipelineStageConfig[];
}

export interface PipelineStageResult {
  id: string;
  agent: AgentId;
  mode: string;
  success: boolean;
  output: string;
  error?: string;
  durationMs: number;
  modelUsed?: string;
}

export interface PipelineExecutionResult {
  success: boolean;
  pipelineName: string;
  topology: string;
  stages: PipelineStageResult[];
  totalDurationMs: number;
  worktree?: WorktreeInstance;
  finalDiffSummary?: string;
  error?: string;
}

export class PipelineEngine {
  /**
   * Execute an automated multi-stage agent pipeline.
   */
  async execute(options: PipelineOptions): Promise<PipelineExecutionResult> {
    const startTime = Date.now();
    const topology = options.topology || 'architect_builder';
    const isolateWorktree = options.isolateWorktree !== false;
    const baseDir = options.workspaceDir || process.cwd();

    let worktreeInstance: WorktreeInstance | undefined;
    let effectiveWorkspaceDir = baseDir;

    // 1. Acquire isolated worktree if requested
    if (isolateWorktree) {
      const alias = `pipe-${options.pipelineName.toLowerCase().replace(/[^a-z0-9_-]/g, '-')}`;
      worktreeInstance = await worktreeManager.createWorktree(alias, baseDir);
      effectiveWorkspaceDir = worktreeInstance.worktreePath;
    }

    // 2. Resolve stages configuration based on topology
    const stages = this.resolveStages(topology, options);

    const stageResults: PipelineStageResult[] = [];
    const stageOutputs = new Map<string, string>();
    let overallSuccess = true;
    let failureError: string | undefined;

    try {
      for (const stage of stages) {
        const adapter = await registry.resolve(stage.agent);

        // Interpolate prompt template with previous stage outputs
        let interpolatedPrompt = stage.promptTemplate;
        for (const [prevId, prevOutput] of stageOutputs.entries()) {
          interpolatedPrompt = interpolatedPrompt
            .replace(new RegExp(`\\{\\{stages\\.${prevId}\\.output\\}\\}`, 'g'), prevOutput)
            .replace(new RegExp(`\\{\\{stages\\.${prevId}\\.output_snippet\\}\\}`, 'g'), prevOutput.slice(0, 500));
        }

        // Include current workspace diff if referenced
        if (interpolatedPrompt.includes('{{current_diff}}')) {
          const diffRes = await inspectGitWorkspace(effectiveWorkspaceDir);
          interpolatedPrompt = interpolatedPrompt.replace(
            '{{current_diff}}',
            diffRes.patch ? `\`\`\`diff\n${diffRes.patch.slice(0, 15000)}\n\`\`\`` : '(no uncommitted modifications)'
          );
        }

        // Execute stage turn
        const stageStart = Date.now();
        const stageRes: AgentTaskResult = await adapter.execute({
          prompt: interpolatedPrompt,
          workspaceDir: effectiveWorkspaceDir,
          sessionId: worktreeInstance?.alias,
          mode: stage.mode,
          model: stage.model,
          thinking: stage.thinking,
          isolateWorktree: false, // Already inside the worktree
          includeDiff: true,
          dangerouslySkipPermissions: true,
        });

        const stageDuration = Date.now() - stageStart;
        const resultItem: PipelineStageResult = {
          id: stage.id,
          agent: stage.agent,
          mode: stage.mode,
          success: stageRes.success,
          output: stageRes.output,
          error: stageRes.error,
          durationMs: stageDuration,
          modelUsed: stageRes.modelUsed,
        };

        stageResults.push(resultItem);
        stageOutputs.set(stage.id, stageRes.output);

        if (!stageRes.success) {
          overallSuccess = false;
          failureError = `Stage "${stage.id}" failed: ${stageRes.error || 'Unknown execution error'}`;
          break;
        }
      }
    } catch (err: any) {
      overallSuccess = false;
      failureError = `Pipeline execution exception: ${err.message}`;
    }

    // 3. Rollback on failure if requested
    if (!overallSuccess && options.autoRollbackOnFailure && worktreeInstance) {
      try {
        await worktreeManager.removeWorktree(worktreeInstance.alias, true);
      } catch {}
    }

    // 4. Capture final diff summary
    let finalDiffSummary: string | undefined;
    if (overallSuccess && worktreeInstance) {
      const finalDiff = await inspectGitWorkspace(effectiveWorkspaceDir);
      finalDiffSummary = `+${finalDiff.insertions} / -${finalDiff.deletions} (${finalDiff.filesChanged.length} files modified)`;
    }

    return {
      success: overallSuccess,
      pipelineName: options.pipelineName,
      topology,
      stages: stageResults,
      totalDurationMs: Date.now() - startTime,
      worktree: worktreeInstance,
      finalDiffSummary,
      error: failureError,
    };
  }

  private resolveStages(topology: string, options: PipelineOptions): PipelineStageConfig[] {
    if (topology === 'custom' && options.customStages && options.customStages.length > 0) {
      return options.customStages;
    }

    if (topology === 'peer_review') {
      return [
        {
          id: 'author',
          agent: 'auto',
          mode: 'edit',
          promptTemplate: `${options.prompt}\nImplement this feature or fix with full test coverage.`,
        },
        {
          id: 'reviewer',
          agent: 'auto',
          mode: 'explain',
          promptTemplate: `Perform a rigorous peer review of the following objective and workspace changes:\n\nObjective: ${options.prompt}\n\nWorkspace Diff:\n{{current_diff}}\n\nReview for correctness, security, performance, and missing test cases.`,
        },
      ];
    }

    // Default: 'architect_builder'
    return [
      {
        id: 'architect',
        agent: 'claude',
        mode: 'plan',
        promptTemplate: `[ARCHITECTURAL BLUEPRINT]\n${options.prompt}\n\nInspect the codebase and produce a detailed step-by-step implementation specification and testing plan. Do not edit files.`,
      },
      {
        id: 'builder',
        agent: 'agy',
        mode: 'edit',
        promptTemplate: `[BUILDER EXECUTION]\nObjective: ${options.prompt}\n\nArchitectural Plan:\n{{stages.architect.output}}\n\nImplement the architectural plan above in code. Make all required modifications, add or fix tests, and ensure the project builds.`,
      },
      {
        id: 'verifier',
        agent: 'claude',
        mode: 'explain',
        promptTemplate: `[VERIFIER AUDIT]\nOriginal Objective: ${options.prompt}\n\nInspect the workspace git diff to verify that the Builder correctly implemented the architectural requirements:\n\n{{current_diff}}\n\nCheck for correctness, code quality, and edge case coverage. Provide a final certification summary.`,
      },
    ];
  }
}

export const pipelineEngine = new PipelineEngine();
