import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export function registerPrompts(server: McpServer): void {
  server.prompt(
    'agy_code_review',
    'Template for requesting a comprehensive code review from Antigravity',
    {
      scope: z
        .string()
        .optional()
        .describe('The scope of review (e.g., recent commits, PR diff, specific file)'),
      focus: z
        .string()
        .optional()
        .describe('Specific review focus (e.g., security, edge cases, performance, architecture)'),
    },
    (args) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Please perform a thorough code review for the following scope: "${args.scope || 'the current working tree and recent changes'}". Focus especially on: ${args.focus || 'code correctness, performance, edge cases, error handling, and maintainability'}. Report actionable findings with file references.`,
          },
        },
      ],
    })
  );

  server.prompt(
    'agy_debug_issue',
    'Template for delegating bug diagnosis and test reproduction to Antigravity',
    {
      error_or_symptom: z
        .string()
        .describe('Description of the bug, error stack trace, or failing test'),
      reproduction_steps: z
        .string()
        .optional()
        .describe('Steps or test command to reproduce the issue'),
    },
    (args) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Please investigate and resolve the following issue:\n\n**Symptom/Error:**\n${args.error_or_symptom}\n\n${args.reproduction_steps ? `**Reproduction Steps:**\n${args.reproduction_steps}\n\n` : ''}Analyze the root cause, locate the relevant files, run necessary reproduction tests or commands, apply the fix, and verify that the tests pass.`,
          },
        },
      ],
    })
  );

  // 3. Supervisor-to-Worker Contract-First Delegation Template
  server.prompt(
    'supervisor_delegate_contract',
    'Contract-first delegation template for an AI supervisor dictating a task to an autonomous coding agent (Objective, Invariants, Acceptance Criteria, Downstream Autonomy)',
    {
      objective: z
        .string()
        .describe('The primary functional objective to achieve'),
      constraints_and_invariants: z
        .string()
        .optional()
        .describe('Non-negotiable constraints, API backwards compatibility, security rules, or styling invariants'),
      acceptance_criteria: z
        .string()
        .optional()
        .describe('Verification criteria or automated test commands (e.g., "npm test passes with exit code 0")'),
      context_or_files: z
        .string()
        .optional()
        .describe('Known relevant files, modules, or architectural background'),
    },
    (args) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              `### 🎯 Objective`,
              args.objective,
              '',
              `### 🛡️ Constraints & Invariants (Non-Negotiables)`,
              args.constraints_and_invariants || '- Preserve existing public API signatures and backwards compatibility.\n- Do not introduce unnecessary external dependencies.\n- Ensure zero lint errors or type regressions.',
              '',
              `### ✅ Acceptance Criteria & Verification`,
              args.acceptance_criteria || '- Implement comprehensive unit and integration test coverage.\n- Verify that automated tests pass cleanly (exit code 0).',
              '',
              args.context_or_files ? `### 📁 Relevant Context & Files\n${args.context_or_files}\n` : '',
              `### 🚀 Downstream Autonomy Directive`,
              'You have full downstream autonomy to navigate the codebase, search files, make code modifications, execute shell commands, and fix any test/compiler failures. Do not stop until all acceptance criteria are satisfied.',
            ].filter(Boolean).join('\n'),
          },
        },
      ],
    })
  );

  // 4. Evaluator-Optimizer Critique Template
  server.prompt(
    'evaluator_code_critique',
    'Rigorous evaluation template for reviewing a worker agent\'s code diff against the supervisor\'s original objective and invariants',
    {
      objective: z
        .string()
        .describe('The original task objective and constraints'),
      diff_or_patch: z
        .string()
        .optional()
        .describe('The git diff patch to evaluate (omit to inspect workspace diff automatically)'),
      review_focus: z
        .string()
        .optional()
        .describe('Specific review focus (e.g. security, edge cases, regression risk, performance)'),
    },
    (args) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              `### 🔍 Evaluator Review Request`,
              `Please perform a rigorous review of the proposed code modifications against the original objective.`,
              '',
              `**Original Objective:**`,
              args.objective,
              '',
              `**Review Focus:**`,
              args.review_focus || 'Correctness, security vulnerabilities, edge case handling, regression risks, and test completeness.',
              '',
              args.diff_or_patch ? `**Workspace Git Diff:**\n\`\`\`diff\n${args.diff_or_patch}\n\`\`\`\n` : '**Workspace Diff:** (Please inspect the current git status and diff using your tools)\n',
              `**Expected Output:**`,
              '1. **Verification Verdict:** [APPROVED | CHANGES_REQUIRED]',
              '2. **Invariant Checks:** Did any non-negotiable constraints break?',
              '3. **Actionable Critiques:** Specific issues identified with line/file references and proposed solutions.',
            ].join('\n'),
          },
        },
      ],
    })
  );

  // 5. Inter-Agent Handoff Template
  server.prompt(
    'agent_handoff_template',
    'Template for packaging structured context when handing off work from one autonomous agent to another',
    {
      originating_agent: z
        .string()
        .describe('Name or role of originating agent (e.g., "Claude-Architect")'),
      target_agent: z
        .string()
        .describe('Name or role of receiving agent (e.g., "Antigravity-Builder")'),
      objective: z
        .string()
        .describe('The global objective being handed over'),
      work_completed: z
        .string()
        .describe('Summary of architectural decisions and changes already completed'),
      next_steps: z
        .string()
        .describe('Explicit instructions and next steps for the receiving agent'),
      open_questions: z
        .string()
        .optional()
        .describe('Any open questions, risks, or blockers for the receiving agent to resolve'),
    },
    (args) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              `=== STRUCTURED INTER-AGENT HANDOFF ===`,
              `From: ${args.originating_agent} | To: ${args.target_agent}`,
              `Objective: ${args.objective}`,
              '',
              `### 📋 Work Completed So Far`,
              args.work_completed,
              '',
              `### 🛠️ Next Steps for ${args.target_agent}`,
              args.next_steps,
              '',
              args.open_questions ? `### ❓ Open Questions & Risks\n${args.open_questions}\n` : '',
              `Please proceed with executing the next steps autonomously. Report the final outcome and diff upon completion.`,
            ].filter(Boolean).join('\n'),
          },
        },
      ],
    })
  );
}
