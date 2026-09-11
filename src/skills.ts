import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

export interface AgentSkill {
  name: string;
  description: string;
  source: 'builtin' | 'user' | 'workspace';
  path: string;
}

export function parseSkillFrontmatter(content: string): { name?: string; description?: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const frontmatter = match[1];

  let name: string | undefined;
  let description: string | undefined;

  const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
  if (nameMatch) {
    name = nameMatch[1].trim().replace(/^['"]|['"]$/g, '');
  }

  const descIndex = frontmatter.indexOf('description:');
  if (descIndex !== -1) {
    const afterDesc = frontmatter.slice(descIndex + 'description:'.length);
    const lines = afterDesc.split(/\r?\n/);
    const descLines: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (i === 0 && line.trim() && !line.trim().startsWith('>-') && !line.trim().startsWith('|')) {
        descLines.push(line.trim());
      } else if (i > 0) {
        if (/^[a-zA-Z0-9_-]+:/.test(line)) {
          break;
        }
        if (line.trim()) {
          descLines.push(line.trim());
        }
      }
    }
    if (descLines.length > 0) {
      description = descLines.join(' ');
    }
  }

  return { name, description };
}

export function discoverSkills(workspaceDir?: string): AgentSkill[] {
  const skills: AgentSkill[] = [];
  const seen = new Set<string>();

  const home = os.homedir();
  const searchDirs: { dir: string; source: 'builtin' | 'user' | 'workspace' }[] = [
    // 1. Workspace skills (highest override priority)
    ...(workspaceDir
      ? [
          { dir: path.join(workspaceDir, '.gemini', 'skills'), source: 'workspace' as const },
          { dir: path.join(workspaceDir, '.agy', 'skills'), source: 'workspace' as const },
          { dir: path.join(workspaceDir, 'skills'), source: 'workspace' as const },
        ]
      : []),
    // 2. Global user skills
    { dir: path.join(home, '.gemini', 'antigravity-cli', 'skills'), source: 'user' as const },
    { dir: path.join(home, '.gemini', 'skills'), source: 'user' as const },
    // 3. Builtin skills
    { dir: path.join(home, '.gemini', 'antigravity-cli', 'builtin', 'skills'), source: 'builtin' as const },
  ];

  for (const { dir, source } of searchDirs) {
    if (!fs.existsSync(dir)) continue;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const skillFile = path.join(dir, entry.name, 'SKILL.md');
          if (fs.existsSync(skillFile)) {
            try {
              const content = fs.readFileSync(skillFile, 'utf-8');
              const meta = parseSkillFrontmatter(content);
              const skillName = meta.name || entry.name;
              if (!seen.has(skillName)) {
                seen.add(skillName);
                skills.push({
                  name: skillName,
                  description: meta.description || 'No description provided.',
                  source,
                  path: skillFile,
                });
              }
            } catch {
              // Ignore read errors
            }
          }
        }
      }
    } catch {
      // Ignore directory access errors
    }
  }

  return skills;
}

export function readSkillContent(
  skillName: string,
  workspaceDir?: string
): { skill?: AgentSkill; content?: string } {
  const allSkills = discoverSkills(workspaceDir);
  const found = allSkills.find((s) => s.name.toLowerCase() === skillName.toLowerCase());
  if (!found) return {};
  try {
    const content = fs.readFileSync(found.path, 'utf-8');
    return { skill: found, content };
  } catch {
    return { skill: found };
  }
}
