import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface GitDiffResult {
  isGitRepo: boolean;
  branch?: string;
  filesChanged: string[];
  insertions: number;
  deletions: number;
  patch?: string;
  rawStatus?: string;
}

/**
 * Inspect workspace git status and diff non-destructively.
 * Never executes destructive operations (no reset, checkout, clean).
 */
export async function inspectGitWorkspace(
  workspaceDir: string = process.cwd()
): Promise<GitDiffResult> {
  const emptyResult: GitDiffResult = {
    isGitRepo: false,
    filesChanged: [],
    insertions: 0,
    deletions: 0,
  };

  try {
    // 1. Verify this is inside a git work tree
    const isRepo = await execFileAsync('git', ['rev-parse', '--is-inside-work-tree'], {
      cwd: workspaceDir,
    }).catch(() => null);

    if (!isRepo || !isRepo.stdout.trim().includes('true')) {
      return emptyResult;
    }

    // 2. Query current branch
    let branch: string | undefined;
    try {
      const branchRes = await execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
        cwd: workspaceDir,
      });
      branch = branchRes.stdout.trim() || undefined;
    } catch {}

    // 3. Query porcelain status to get list of touched files
    let rawStatus = '';
    const filesChanged: string[] = [];
    try {
      const statusRes = await execFileAsync('git', ['status', '--porcelain'], {
        cwd: workspaceDir,
      });
      rawStatus = statusRes.stdout.trim();
      const lines = rawStatus.split('\n').filter(Boolean);
      for (const line of lines) {
        // format: XY filename or XY orig -> new
        const filepath = line.slice(3).trim();
        if (filepath) {
          filesChanged.push(filepath);
        }
      }
    } catch {}

    // 4. Query diff stats (insertions, deletions)
    let insertions = 0;
    let deletions = 0;
    try {
      const statRes = await execFileAsync('git', ['diff', '--stat', 'HEAD'], {
        cwd: workspaceDir,
      }).catch(async () => {
        // Fallback if no HEAD commits exist
        return execFileAsync('git', ['diff', '--stat'], { cwd: workspaceDir });
      });

      const statOutput = statRes.stdout.trim();
      // Match summary line: "X files changed, Y insertions(+), Z deletions(-)"
      const insMatch = statOutput.match(/(\d+)\s+insertion/);
      const delMatch = statOutput.match(/(\d+)\s+deletion/);
      if (insMatch) insertions = parseInt(insMatch[1], 10);
      if (delMatch) deletions = parseInt(delMatch[1], 10);
    } catch {}

    // 5. Query actual unified diff patch (safely capped to 40KB)
    let patch: string | undefined;
    try {
      const diffRes = await execFileAsync('git', ['diff', '-U3', 'HEAD'], {
        cwd: workspaceDir,
        maxBuffer: 5 * 1024 * 1024,
      }).catch(async () => {
        return execFileAsync('git', ['diff', '-U3'], {
          cwd: workspaceDir,
          maxBuffer: 5 * 1024 * 1024,
        });
      });

      const fullPatch = diffRes.stdout.trim();
      if (fullPatch) {
        if (fullPatch.length > 40000) {
          patch = fullPatch.slice(0, 40000) + '\n\n... [Diff truncated to 40KB] ...';
        } else {
          patch = fullPatch;
        }
      }
    } catch {}

    return {
      isGitRepo: true,
      branch,
      filesChanged,
      insertions,
      deletions,
      patch,
      rawStatus: rawStatus || undefined,
    };
  } catch {
    return emptyResult;
  }
}
