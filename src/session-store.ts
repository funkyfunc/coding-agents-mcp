import { AgentId } from './adapters/types.js';

export interface SessionInfo {
  sessionId: string;
  alias?: string;
  agent: AgentId;
  title?: string;
  turns: number;
  tokens: number;
  lastActive: string;
}

// In-memory active session per agent
const activeSessions = new Map<AgentId, string>();

// Registry of all known sessions and aliases
const sessionRegistry = new Map<string, SessionInfo>();

// Alias to Session ID mapping
const aliasToSessionId = new Map<string, string>();

/**
 * Get currently active session ID for a specific agent.
 */
export function getActiveSession(agent: AgentId): string | undefined {
  return activeSessions.get(agent);
}

/**
 * Set active session ID for a specific agent.
 */
export function setActiveSession(
  agent: AgentId,
  sessionId: string,
  alias?: string
): void {
  activeSessions.set(agent, sessionId);

  if (alias) {
    aliasToSessionId.set(alias.toLowerCase(), sessionId);
  }

  const existing = sessionRegistry.get(sessionId);
  if (existing) {
    if (alias) existing.alias = alias;
    existing.lastActive = new Date().toISOString();
  } else {
    sessionRegistry.set(sessionId, {
      sessionId,
      alias,
      agent,
      title: alias || `Session ${sessionId.slice(0, 8)}`,
      turns: 0,
      tokens: 0,
      lastActive: new Date().toISOString(),
    });
  }
}

/**
 * Resolve a session identifier (UUID, alias, "new", or omitted).
 */
export function resolveSessionId(
  agent: AgentId,
  rawId?: string
): { sessionId?: string; alias?: string; isNew: boolean } {
  if (!rawId) {
    const active = getActiveSession(agent);
    return { sessionId: active, isNew: !active };
  }

  const trimmed = rawId.trim();
  if (trimmed.toLowerCase() === 'new') {
    activeSessions.delete(agent);
    return { isNew: true };
  }

  // Check if rawId is a known friendly alias
  const fromAlias = aliasToSessionId.get(trimmed.toLowerCase());
  if (fromAlias) {
    return { sessionId: fromAlias, alias: trimmed, isNew: false };
  }

  // Check if rawId looks like a UUID or friendly name to register
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    trimmed
  );

  if (isUuid) {
    return { sessionId: trimmed, isNew: false };
  }

  // Treat non-UUID identifier as a friendly alias name
  return { alias: trimmed, isNew: true };
}

/**
 * Update session statistics after task execution.
 */
export function recordSessionActivity(
  agent: AgentId,
  sessionId: string,
  tokens: number = 0,
  title?: string,
  alias?: string
): void {
  let entry = sessionRegistry.get(sessionId);
  if (!entry) {
    entry = {
      sessionId,
      alias,
      agent,
      title: title || alias || `Session ${sessionId.slice(0, 8)}`,
      turns: 1,
      tokens,
      lastActive: new Date().toISOString(),
    };
    sessionRegistry.set(sessionId, entry);
  } else {
    entry.turns += 1;
    entry.tokens += tokens;
    if (title && !entry.alias) entry.title = title;
    if (alias) entry.alias = alias;
    entry.lastActive = new Date().toISOString();
  }

  // Ensure this session is active for the agent
  activeSessions.set(agent, sessionId);
  if (alias) {
    aliasToSessionId.set(alias.toLowerCase(), sessionId);
  }
}

/**
 * Reset active session for a specific agent, or all agents.
 */
export function resetSession(agent?: AgentId): {
  resetCount: number;
  agents: string[];
} {
  const resetAgents: string[] = [];

  if (agent && agent !== 'auto') {
    if (activeSessions.has(agent)) {
      activeSessions.delete(agent);
      resetAgents.push(agent);
    }
  } else {
    for (const key of activeSessions.keys()) {
      resetAgents.push(key);
    }
    activeSessions.clear();
  }

  return {
    resetCount: resetAgents.length,
    agents: resetAgents,
  };
}

/**
 * List all sessions in registry.
 */
export function listAllSessions(): Array<
  SessionInfo & { isActive: boolean }
> {
  const results: Array<SessionInfo & { isActive: boolean }> = [];

  for (const session of sessionRegistry.values()) {
    const isActive = activeSessions.get(session.agent) === session.sessionId;
    results.push({
      ...session,
      isActive,
    });
  }

  // Sort: active sessions first, then most recently active
  results.sort((a, b) => {
    if (a.isActive && !b.isActive) return -1;
    if (!a.isActive && b.isActive) return 1;
    return new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime();
  });

  return results;
}
