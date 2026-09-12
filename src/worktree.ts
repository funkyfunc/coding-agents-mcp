import * as path from 'node:path';
import * as fs from 'node:fs';
import { GitDiffResult, inspectGitWorkspace, safeGitExec } from './git.js';

export interface WorktreeInstance {
  alias: string;
  worktreePath: string;
  branchName: string;
  baseBranch: string;
  createdAt: number;
}

export class GitWorktreeManager {
  private activeWorktrees = new Map<string, WorktreeInstance>();

  /**
   * Get the root directory of the git repo for a given path.
   */
  async getRepoRoot(dir: string = process.cwd()): Promise<string> {
    const res = await safeGitExec(['rev-parse', '--show-toplevel'], { cwd: dir });
    const raw = res.stdout.trim();
    return fs.existsSync(raw) ? fs.realpathSync(raw) : raw;
  }

  /**
   * Check if the directory is a git repository.
   */
  async isGitRepo(dir: string = process.cwd()): Promise<boolean> {
    try {
      const res = await safeGitExec(['rev-parse', '--is-inside-work-tree'], { cwd: dir });
      return res.stdout.trim().includes('true');
    } catch {
      return false;
    }
  }

  /**
   * Create an ephemeral worktree for a session alias.
   * Hardened against GitSpawn and symlink breakout vectors.
   */
  async createWorktree(
    alias: string,
    workspaceDir: string = process.cwd()
  ): Promise<WorktreeInstance> {
    const repoRoot = await this.getRepoRoot(workspaceDir);
    const cleanAlias = alias.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    const branchName = `agent/${cleanAlias}-${Date.now()}`;
    const worktreeDir = path.join(repoRoot, '.git', 'agent-worktrees', cleanAlias);

    // Path canonicalization verification: worktree target must reside inside repoRoot
    const resolvedRepoRoot = fs.existsSync(repoRoot) ? fs.realpathSync(repoRoot) : path.resolve(repoRoot);
    const resolvedParent = path.resolve(path.dirname(worktreeDir));
    if (!resolvedParent.startsWith(resolvedRepoRoot)) {
      throw new Error(`Security Exception: Worktree path escapes repository root: ${worktreeDir}`);
    }

    // If already tracked and directory exists, return existing
    if (this.activeWorktrees.has(cleanAlias)) {
      const existing = this.activeWorktrees.get(cleanAlias)!;
      if (fs.existsSync(existing.worktreePath)) {
        return existing;
      }
      this.activeWorktrees.delete(cleanAlias);
    }

    // Clean up previous leftover dir if exists
    if (fs.existsSync(worktreeDir)) {
      try {
        await safeGitExec(['worktree', 'remove', '--force', worktreeDir], { cwd: repoRoot });
      } catch {
        fs.rmSync(worktreeDir, { recursive: true, force: true });
        await safeGitExec(['worktree', 'prune'], { cwd: repoRoot }).catch(() => {});
      }
    }

    // Get current HEAD branch
    let baseBranch = 'HEAD';
    try {
      const branchRes = await safeGitExec(['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: repoRoot });
      baseBranch = branchRes.stdout.trim() || 'HEAD';
    } catch {}

    // Ensure parent dir exists
    fs.mkdirSync(path.dirname(worktreeDir), { recursive: true });

    // Enable worktreeConfig extension to sandbox config overrides
    try {
      await safeGitExec(['config', 'extensions.worktreeConfig', 'true'], { cwd: repoRoot });
    } catch {}

    // Execute git worktree add with security overrides (disabling hooks & fsmonitor)
    await safeGitExec(['worktree', 'add', '-b', branchName, worktreeDir, 'HEAD'], {
      cwd: repoRoot,
    });

    const instance: WorktreeInstance = {
      alias: cleanAlias,
      worktreePath: worktreeDir,
      branchName,
      baseBranch,
      createdAt: Date.now(),
    };

    this.activeWorktrees.set(cleanAlias, instance);
    return instance;
  }

  /**
   * Get an active worktree by alias.
   */
  getWorktree(alias: string): WorktreeInstance | undefined {
    const cleanAlias = alias.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    return this.activeWorktrees.get(cleanAlias);
  }

  /**
   * Inspect status & diff of an active worktree.
   */
  async inspectWorktree(alias: string): Promise<GitDiffResult & { branchName?: string; worktreePath?: string }> {
    const cleanAlias = alias.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    const instance = this.activeWorktrees.get(cleanAlias);
    if (!instance || !fs.existsSync(instance.worktreePath)) {
      throw new Error(`Worktree for alias "${alias}" not found or already removed.`);
    }

    const diff = await inspectGitWorkspace(instance.worktreePath);
    return {
      ...diff,
      branchName: instance.branchName,
      worktreePath: instance.worktreePath,
    };
  }

  /**
   * Merge changes from a worktree back into the base repository.
   */
  async mergeWorktree(
    alias: string,
    options: { squash?: boolean; commitMessage?: string; workspaceDir?: string } = {}
  ): Promise<{ success: boolean; commitSha?: string; filesChanged: string[] }> {
    const cleanAlias = alias.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    const instance = this.activeWorktrees.get(cleanAlias);
    if (!instance) {
      throw new Error(`Worktree for alias "${alias}" not found.`);
    }

    const repoRoot = await this.getRepoRoot(options.workspaceDir || process.cwd());

    // Check diff before merging
    const diff = await inspectGitWorkspace(instance.worktreePath);
    if (diff.filesChanged.length === 0) {
      await this.removeWorktree(alias);
      return { success: true, filesChanged: [] };
    }

    // In worktree, commit any uncommitted changes first
    try {
      await safeGitExec(['add', '-A'], { cwd: instance.worktreePath });
      await safeGitExec(
        ['commit', '-m', options.commitMessage || `Agent changes from ${alias}`],
        { cwd: instance.worktreePath }
      );
    } catch {
      // In case changes were already committed
    }

    // Merge into base repository
    const squash = options.squash !== false;
    if (squash) {
      await safeGitExec(['merge', '--squash', instance.branchName], { cwd: repoRoot });
      if (options.commitMessage) {
        await safeGitExec(['commit', '-m', options.commitMessage], { cwd: repoRoot });
      }
    } else {
      await safeGitExec(
        [
          'merge',
          '--no-ff',
          '-m',
          options.commitMessage || `Merge agent branch ${instance.branchName}`,
          instance.branchName,
        ],
        { cwd: repoRoot }
      );
    }

    let commitSha: string | undefined;
    try {
      const shaRes = await safeGitExec(['rev-parse', 'HEAD'], { cwd: repoRoot });
      commitSha = shaRes.stdout.trim();
    } catch {}

    // Clean up worktree and temporary branch
    await this.removeWorktree(alias);

    return {
      success: true,
      commitSha,
      filesChanged: diff.filesChanged,
    };
  }

  /**
   * Discard/remove a worktree and delete its ephemeral branch.
   */
  async removeWorktree(alias: string, force = true): Promise<void> {
    const cleanAlias = alias.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    const instance = this.activeWorktrees.get(cleanAlias);
    if (!instance) return;

    try {
      const repoRoot = await this.getRepoRoot(path.dirname(instance.worktreePath)).catch(() => process.cwd());
      if (fs.existsSync(instance.worktreePath)) {
        await safeGitExec(
          ['worktree', 'remove', force ? '--force' : '', instance.worktreePath].filter(Boolean),
          { cwd: repoRoot }
        ).catch(() => {
          fs.rmSync(instance.worktreePath, { recursive: true, force: true });
        });
      }

      await safeGitExec(['branch', '-D', instance.branchName], { cwd: repoRoot }).catch(() => {});
      await safeGitExec(['worktree', 'prune'], { cwd: repoRoot }).catch(() => {});
    } finally {
      this.activeWorktrees.delete(cleanAlias);
    }
  }

  /**
   * List all active worktrees managed by this server.
   */
  listWorktrees(): WorktreeInstance[] {
    return Array.from(this.activeWorktrees.values());
  }

  /**
   * Clean up all active worktrees (e.g. on shutdown).
   */
  async cleanupAll(): Promise<void> {
    for (const alias of Array.from(this.activeWorktrees.keys())) {
      try {
        await this.removeWorktree(alias, true);
      } catch {}
    }
  }
}

export const worktreeManager = new GitWorktreeManager();
