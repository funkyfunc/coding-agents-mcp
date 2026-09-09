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

export class CodexAdapter implements BaseAgentAdapter {
  readonly id: AgentId = 'codex';
  readonly name = 'OpenAI Codex CLI';

  async isAvailable(): Promise<boolean> {
    try {
      await execFileAsync('which', ['codex']);
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
        const res = await execFileAsync('codex', ['--version']);
        version = res.stdout.trim();
      } catch {}
    }

    return {
      id: this.id,
      name: this.name,
      installed,
      version,
      authenticated: installed,
      models: ['gpt-4o-mini', 'gpt-4o', 'o3-mini'],
      defaultModel: 'gpt-4o-mini',
      thinkingLevels: ['low', 'medium', 'high'],
      notes: installed
        ? 'OpenAI Codex CLI detected and ready.'
        : 'OpenAI Codex CLI not found on PATH. Install via: npm install -g @openai/codex or configure CODEX_BIN.',
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
          'OpenAI Codex CLI is not installed or not found on PATH.\nTo install: npm install -g @openai/codex\nCurrently active agents: "claude", "agy".',
        durationMs: 0,
      };
    }

    // When installed, exec codex with full-auto mode
    return {
      success: false,
      agent: this.id,
      output: '',
      error: 'Codex CLI adapter integration is currently in preview mode.',
      durationMs: 0,
    };
  }
}
