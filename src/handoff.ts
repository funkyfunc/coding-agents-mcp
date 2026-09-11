import { AgentId } from './adapters/types.js';
import { registry } from './adapters/registry.js';
import { inspectGitWorkspace, GitDiffResult } from './git.js';

export interface StructuredHandoffPacket {
  version: '1.0';
  handoffId: string;
  timestamp: string;
  source: {
    agent: AgentId;
    sessionId?: string;
  };
  target: {
    agent: AgentId;
    mode: 'edit' | 'plan' | 'explain';
  };
  objective: string;
  summary: string;
  codeState?: {
    filesModified: string[];
    insertions: number;
    deletions: number;
    patch?: string;
  };
  instructionsForTarget: string;
  openQuestions?: string[];
}

export interface MailboxMessage {
  id: string;
  sender: AgentId;
  recipient: AgentId | 'broadcast';
  type: 'inquiry' | 'critique' | 'artifact' | 'status';
  subject: string;
  content: string;
  timestamp: string;
  read: boolean;
}

class MailboxManager {
  private messages: MailboxMessage[] = [];

  send(sender: AgentId, recipient: AgentId | 'broadcast', subject: string, content: string, type: MailboxMessage['type'] = 'inquiry'): MailboxMessage {
    const msg: MailboxMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sender,
      recipient,
      type,
      subject,
      content,
      timestamp: new Date().toISOString(),
      read: false,
    };
    this.messages.push(msg);
    return msg;
  }

  getMessagesFor(agent: AgentId): MailboxMessage[] {
    return this.messages.filter((m) => m.recipient === agent || m.recipient === 'broadcast');
  }

  readMessage(id: string): MailboxMessage | undefined {
    const msg = this.messages.find((m) => m.id === id);
    if (msg) msg.read = true;
    return msg;
  }

  listAll(): MailboxMessage[] {
    return [...this.messages];
  }

  clear(): number {
    const count = this.messages.length;
    this.messages = [];
    return count;
  }
}

export const mailbox = new MailboxManager();

export async function createHandoffPacket(params: {
  fromAgent: AgentId;
  toAgent: AgentId;
  objective: string;
  instructions: string;
  summary?: string;
  sessionId?: string;
  workspaceDir?: string;
  targetMode?: 'edit' | 'plan' | 'explain';
  openQuestions?: string[];
}): Promise<StructuredHandoffPacket> {
  const cwd = params.workspaceDir || process.cwd();
  const diffResult = await inspectGitWorkspace(cwd);

  return {
    version: '1.0',
    handoffId: `hnd-${Date.now().toString(36)}`,
    timestamp: new Date().toISOString(),
    source: {
      agent: params.fromAgent,
      sessionId: params.sessionId,
    },
    target: {
      agent: params.toAgent,
      mode: params.targetMode || 'edit',
    },
    objective: params.objective,
    summary: params.summary || `Handoff from ${params.fromAgent.toUpperCase()} to ${params.toAgent.toUpperCase()}`,
    codeState: {
      filesModified: diffResult.filesChanged,
      insertions: diffResult.insertions,
      deletions: diffResult.deletions,
      patch: diffResult.patch,
    },
    instructionsForTarget: params.instructions,
    openQuestions: params.openQuestions,
  };
}

export function formatHandoffPrompt(packet: StructuredHandoffPacket): string {
  const lines: string[] = [
    `=== STRUCTURED INTER-AGENT HANDOFF (ID: ${packet.handoffId}) ===`,
    `Sender: ${packet.source.agent.toUpperCase()} | Receiver: ${packet.target.agent.toUpperCase()}`,
    `Primary Objective: ${packet.objective}`,
    `Context Summary: ${packet.summary}`,
    '',
    `=== INSTRUCTIONS FOR ${packet.target.agent.toUpperCase()} ===`,
    packet.instructionsForTarget,
  ];

  if (packet.codeState && packet.codeState.filesModified.length > 0) {
    lines.push(
      '',
      `=== MODIFIED CODE CONTEXT (+${packet.codeState.insertions}/-${packet.codeState.deletions}) ===`,
      `Files Touched: ${packet.codeState.filesModified.join(', ')}`
    );

    if (packet.codeState.patch) {
      lines.push('\nGit Diff Patch:\n```diff\n' + packet.codeState.patch.slice(0, 10000) + '\n```');
    }
  }

  if (packet.openQuestions && packet.openQuestions.length > 0) {
    lines.push('', '=== OPEN QUESTIONS / POINTS FOR REVIEW ===');
    for (const q of packet.openQuestions) {
      lines.push(`- ${q}`);
    }
  }

  return lines.join('\n');
}
