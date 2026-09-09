import {
  BaseAgentAdapter,
  AgentId,
  AgentStatus,
} from './types.js';
import { ClaudeAdapter } from './claude.js';
import { AgyAdapter } from './agy.js';
import { CodexAdapter } from './codex.js';
import { CursorAdapter } from './cursor.js';

class AdapterRegistry {
  private adapters = new Map<AgentId, BaseAgentAdapter>();

  constructor() {
    this.register(new ClaudeAdapter());
    this.register(new AgyAdapter());
    this.register(new CodexAdapter());
    this.register(new CursorAdapter());
  }

  register(adapter: BaseAgentAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  get(id: AgentId): BaseAgentAdapter | undefined {
    return this.adapters.get(id);
  }

  /**
   * Resolve an adapter, either by explicit ID or by automatic discovery.
   */
  async resolve(requested?: AgentId): Promise<BaseAgentAdapter> {
    if (!requested || requested === 'auto') {
      // Auto-detect installed agents: prioritize claude, then agy
      const claude = this.adapters.get('claude')!;
      if (await claude.isAvailable()) {
        return claude;
      }

      const agy = this.adapters.get('agy')!;
      if (await agy.isAvailable()) {
        return agy;
      }

      // Check remaining
      for (const [id, adapter] of this.adapters.entries()) {
        if (id !== 'auto' && (await adapter.isAvailable())) {
          return adapter;
        }
      }

      // If none available, default to claude and let it report actionable install instructions
      return claude;
    }

    const adapter = this.adapters.get(requested);
    if (!adapter) {
      const valid = Array.from(this.adapters.keys()).filter((k) => k !== 'auto');
      throw new Error(
        `Unknown agent backend: "${requested}". Valid agents: ${valid.join(', ')}`
      );
    }

    return adapter;
  }

  /**
   * Collect statuses for all registered adapters.
   */
  async getAllStatuses(): Promise<AgentStatus[]> {
    const promises = Array.from(this.adapters.values()).map((a) => a.getStatus());
    return Promise.all(promises);
  }
}

export const registry = new AdapterRegistry();
