import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { discoverSkills, readSkillContent } from '../skills.js';

export function registerSkillsTool(server: McpServer): void {
  server.tool(
    'agent_skills',
    'Discover or inspect specialized domain skills available to subordinate agents (e.g. Google Antigravity custom skills).',
    {
      action: z
        .enum(['list', 'inspect'])
        .optional()
        .default('list')
        .describe(
          'Action to perform:\n- "list": List all discovered builtin, user, and workspace skills.\n- "inspect": View the full documentation and instructions for a specific skill.'
        ),
      agent: z
        .enum(['auto', 'agy', 'claude', 'codex', 'cursor'])
        .optional()
        .default('agy')
        .describe('Target agent to query skills for (default: "agy").'),
      skill_name: z
        .string()
        .optional()
        .describe('Name of the skill to inspect when action="inspect".'),
      workspace_dir: z
        .string()
        .optional()
        .describe('Workspace directory to scan for project-local skills.'),
    },
    async (args) => {
      try {
        if (args.agent !== 'agy' && args.agent !== 'auto') {
          return {
            content: [
              {
                type: 'text',
                text: `ℹ️ Agent \`${args.agent.toUpperCase()}\` does not use the Antigravity skills system. Custom rules for Claude are loaded via \`CLAUDE.md\` and Cursor via \`.cursorrules\`.`,
              },
            ],
          };
        }

        const workspaceDir = args.workspace_dir || process.cwd();

        if (args.action === 'inspect') {
          if (!args.skill_name) {
            return {
              content: [
                {
                  type: 'text',
                  text: '⚠️ **Error:** Must provide `skill_name` when action="inspect".',
                },
              ],
              isError: true,
            };
          }

          const { skill, content } = readSkillContent(args.skill_name, workspaceDir);
          if (!skill) {
            const available = discoverSkills(workspaceDir)
              .map((s) => `\`${s.name}\``)
              .join(', ');
            return {
              content: [
                {
                  type: 'text',
                  text: `⚠️ **Skill Not Found:** \`${args.skill_name}\`.\n\nAvailable skills: ${available || 'none'}.`,
                },
              ],
              isError: true,
            };
          }

          const lines = [
            `# 🧠 Skill: \`${skill.name}\``,
            `- **Source:** \`${skill.source}\``,
            `- **Path:** \`${skill.path}\``,
            `- **Description:** ${skill.description}`,
            '',
            '---',
            '',
            content || '*(No content available)*',
          ];

          return {
            content: [
              {
                type: 'text',
                text: lines.join('\n'),
              },
            ],
          };
        }

        // Default: action === 'list'
        const skills = discoverSkills(workspaceDir);
        if (skills.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'ℹ️ No specialized domain skills discovered in builtin or local directories.',
              },
            ],
          };
        }

        const lines = [
          `### 🧠 Available Domain Skills for Google Antigravity (${skills.length})`,
          '',
          '| Skill Name | Source | Description |',
          '| :--- | :--- | :--- |',
        ];

        for (const s of skills) {
          const shortDesc = s.description.length > 80 ? `${s.description.slice(0, 77)}...` : s.description;
          lines.push(`| \`${s.name}\` | \`${s.source}\` | ${shortDesc} |`);
        }

        lines.push('');
        lines.push('> **Tip:** To inject any of these skills into an Antigravity delegation turn, pass `skills: ["<name>"]` in `delegate_task`.');

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
          content: [
            {
              type: 'text',
              text: `⚠️ **Skills Query Failed:** ${err.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
