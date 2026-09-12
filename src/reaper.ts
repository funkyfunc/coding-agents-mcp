import { ChildProcess, execSync } from 'node:child_process';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export interface ActiveProcess {
  pid: number;
  child: ChildProcess;
  agent: string;
  description: string;
  startTime: number;
}

const activeProcesses = new Map<number, ActiveProcess>();
let hooksInstalled = false;
let isShuttingDown = false;

/**
 * Register an active child process to be tracked and reaped on disconnect.
 */
export function registerChildProcess(
  child: ChildProcess,
  agent: string,
  description: string
): number {
  if (!child.pid) return 0;
  const pid = child.pid;
  activeProcesses.set(pid, {
    pid,
    child,
    agent,
    description,
    startTime: Date.now(),
  });

  child.on('exit', () => {
    activeProcesses.delete(pid);
  });

  child.on('error', () => {
    activeProcesses.delete(pid);
  });

  return pid;
}

/**
 * Unregister a child process once it has cleanly finished.
 */
export function unregisterChildProcess(pid: number): void {
  activeProcesses.delete(pid);
}

/**
 * Get count of currently active child processes.
 */
export function getActiveProcessCount(): number {
  return activeProcesses.size;
}

/**
 * Terminate a process and all of its descendants across platform boundaries.
 * On POSIX, sends the signal to the negative PID (-pid) to terminate the entire process group.
 * On Windows, invokes taskkill /pid ${pid} /T /F.
 */
export function killProcessTree(pid: number, signal: NodeJS.Signals = 'SIGTERM'): void {
  if (!pid) return;

  if (process.platform === 'win32') {
    try {
      execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' });
    } catch {}
    return;
  }

  // POSIX: Send signal to the process group (-pid)
  try {
    process.kill(-pid, signal);
    return;
  } catch (err: any) {
    // If process is not group leader (e.g. ESRCH or EPERM), fallback to direct PID
    try {
      process.kill(pid, signal);
    } catch {}
  }
}

/**
 * Kill all currently running child processes to prevent zombies.
 * Uses process group signaling (-pid) on POSIX and taskkill on Windows.
 */
export function reapAllChildren(reason: string): void {
  if (activeProcesses.size === 0) return;

  process.stderr.write(
    `[coding-agents-mcp] Reaping ${activeProcesses.size} active child process tree(s) (${reason})...\n`
  );

  for (const [pid, entry] of activeProcesses.entries()) {
    try {
      process.stderr.write(
        `[coding-agents-mcp] Killing ${entry.agent} process tree (PID: ${pid}, task: "${entry.description.slice(0, 40)}")...\n`
      );
      killProcessTree(pid, 'SIGTERM');

      // Schedule aggressive SIGKILL fallback if process does not exit in 1.5s
      setTimeout(() => {
        try {
          killProcessTree(pid, 'SIGKILL');
        } catch {}
      }, 1500).unref();
    } catch (err: any) {
      process.stderr.write(
        `[coding-agents-mcp] Error terminating PID ${pid}: ${err.message}\n`
      );
    }
  }

  activeProcesses.clear();
}

const shutdownCallbacks: Array<() => Promise<void> | void> = [];

/**
 * Register a cleanup callback to be executed on server shutdown.
 */
export function registerShutdownCallback(fn: () => Promise<void> | void): void {
  shutdownCallbacks.push(fn);
}

/**
 * Install process signals and stdin closure hooks to guarantee zero orphan processes.
 */
export function setupShutdownHooks(server?: McpServer): void {
  if (hooksInstalled) return;
  hooksInstalled = true;

  const gracefulShutdown = async (reason: string, code = 0) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    process.stderr.write(`[coding-agents-mcp] Shutting down (${reason})...\n`);
    reapAllChildren(reason);

    for (const cb of shutdownCallbacks) {
      try {
        await cb();
      } catch {}
    }

    if (server) {
      try {
        await server.close();
      } catch {}
    }

    process.exit(code);
  };

  // 1. Trap parent process disconnects via stdin closure
  process.stdin.on('close', () => {
    gracefulShutdown('Parent closed stdin pipe');
  });

  process.stdin.on('end', () => {
    gracefulShutdown('Parent ended stdin stream');
  });

  // 2. Standard process termination signals
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGHUP', () => gracefulShutdown('SIGHUP (terminal closed)'));

  // 3. Process exit fallback
  process.on('exit', () => {
    reapAllChildren('Process exit');
  });

  // 4. Exception handlers
  process.on('uncaughtException', (err) => {
    process.stderr.write(
      `[coding-agents-mcp] Uncaught exception: ${err.stack || err}\n`
    );
    gracefulShutdown('Uncaught exception', 1);
  });

  process.on('unhandledRejection', (reason) => {
    process.stderr.write(
      `[coding-agents-mcp] Unhandled rejection: ${reason}\n`
    );
  });
}
