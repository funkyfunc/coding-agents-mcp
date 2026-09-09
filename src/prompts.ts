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
}
