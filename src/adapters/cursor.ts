import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  BaseAgentAdapter,
  AgentId,
  AgentStatus,
  AgentTaskOptions,
  AgentTaskResult,
} from './types.js';

const execFileAsync = promisify(execFile);

export class CursorAdapter implements BaseAgentAdapter {
  readonly id: AgentId = 'cursor';
  readonly name = 'Cursor Agent CLI';

  async isAvailable(): Promise<boolean> {
    try {
      await execFileAsync('which', ['cursor']);
      return true;
    } catch {
      return false;
    }
  }

  async getStatus(): Promise<AgentStatus> {
    const installed = await this.isAvailable();
    let version: string | undefined;

    if (installed) {
      try {
        const res = await execFileAsync('cursor', ['--version']);
        version = res.stdout.trim().split('\n')[0];
      } catch {}
    }

    return {
      id: this.id,
      name: this.name,
      installed,
      version,
      authenticated: installed,
      models: ['cursor-agent'],
      defaultModel: 'cursor-agent',
      thinkingLevels: [],
      notes: installed
        ? 'Cursor CLI detected.'
        : 'Cursor CLI not found on PATH. Install Cursor and run "Install \'cursor\' command" from command palette.',
    };
  }

  async execute(options: AgentTaskOptions): Promise<AgentTaskResult> {
    const installed = await this.isAvailable();
    if (!installed) {
      return {
        success: false,
        agent: this.id,
        output: '',
        error:
          'Cursor CLI is not installed or not found on PATH.\nTo install: Launch Cursor, open Command Palette (Cmd+Shift+P), and run "Install \'cursor\' command in PATH".\nCurrently active agents: "claude", "agy".',
        durationMs: 0,
      };
    }

    return {
      success: false,
      agent: this.id,
      output: '',
      error: 'Cursor Agent adapter integration is currently in preview mode.',
      durationMs: 0,
    };
  }
}
