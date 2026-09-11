import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { registry } from '../adapters/registry.js';
import { AgentId } from '../adapters/types.js';
import { createHandoffPacket, formatHandoffPrompt, mailbox } from '../handoff.js';
import { formatAgentResponse } from './formatters.js';

export function registerHandoffTools(server: McpServer): void {
  // 1. Inter-Agent Task Handoff Tool
  server.tool(
    'delegate_handoff',
    'Formally transfer task execution and code context from Agent A to Agent B using a Structured Handoff Packet. Bundles objective, semantic summary, and git diff patch without noisy transcript bloat.',
    {
      from_agent: z
        .enum(['auto', 'claude', 'agy', 'codex', 'cursor'])
        .describe('Originating agent transferring the task.'),
      to_agent: z
        .enum(['auto', 'claude', 'agy', 'codex', 'cursor'])
        .describe('Receiving agent taking over the task.'),
      objective: z
        .string()
        .describe('Global task objective.'),
      instructions: z
        .string()
        .describe('Explicit instructions and next steps for the receiving agent.'),
      summary: z
        .string()
        .optional()
        .describe('Summary of work already completed by the originating agent.'),
      target_mode: z
        .enum(['edit', 'plan', 'explain'])
        .optional()
        .default('edit')
        .describe('Mode for the receiving agent ("edit", "plan", or "explain").'),
      session_id: z
        .string()
        .optional()
        .describe('Session ID or friendly alias to continue with the receiving agent.'),
      workspace_dir: z
        .string()
        .optional()
        .describe('Target workspace directory.'),
      open_questions: z
        .array(z.string())
        .optional()
        .describe('Specific questions or blockers for the receiving agent to resolve.'),
    },
    async (args) => {
      try {
        const fromAgent = args.from_agent as AgentId;
        const toAgent = args.to_agent as AgentId;

        // 1. Build the Structured Handoff Packet
        const packet = await createHandoffPacket({
          fromAgent,
          toAgent,
          objective: args.objective,
          instructions: args.instructions,
          summary: args.summary,
          sessionId: args.session_id,
          workspaceDir: args.workspace_dir,
          targetMode: args.target_mode,
          openQuestions: args.open_questions,
        });

        // 2. Resolve receiving adapter
        const targetAdapter = await registry.resolve(toAgent);

        // 3. Format structured handoff prompt
        const promptText = formatHandoffPrompt(packet);

        // 4. Execute receiving agent
        const result = await targetAdapter.execute({
          prompt: promptText,
          workspaceDir: args.workspace_dir,
          sessionId: args.session_id,
          mode: args.target_mode,
          dangerouslySkipPermissions: true,
          includeDiff: true,
        });

        const formatted = formatAgentResponse(result, `Handoff from ${fromAgent.toUpperCase()}`);

        return {
          content: [
            {
              type: 'text',
              text: `### 🤝 Inter-Agent Handoff: \`${fromAgent.toUpperCase()}\` ➔ \`${toAgent.toUpperCase()}\` [ID: \`${packet.handoffId}\`]\n\n${formatted}`,
            },
          ],
          isError: !result.success,
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `⚠️ **Handoff Error:** ${err.message}` }],
        };
      }
    }
  );

  // 2. Inter-Agent Mailbox / Message Queue Tool
  server.tool(
    'agent_mailbox',
    'Asynchronous message queue between CLI coding agents. Allows agents to post inquiries, requests for review, status updates, or artifacts to peer agents.',
    {
      action: z
        .enum(['send', 'check', 'read', 'list', 'clear'])
        .describe('Action: "send" a message, "check" inbox for an agent, "read" a specific message, "list" all messages, "clear" mailbox.'),
      sender: z
        .enum(['auto', 'claude', 'agy', 'codex', 'cursor'])
        .optional()
        .describe('Sender agent (required for "send").'),
      recipient: z
        .enum(['auto', 'claude', 'agy', 'codex', 'cursor', 'broadcast'])
        .optional()
        .describe('Recipient agent (required for "send" or "check").'),
      subject: z
        .string()
        .optional()
        .describe('Message subject line.'),
      content: z
        .string()
        .optional()
        .describe('Message content or artifact payload.'),
      message_id: z
        .string()
        .optional()
        .describe('Message ID to read (required for "read").'),
    },
    async (args) => {
      try {
        switch (args.action) {
          case 'send': {
            if (!args.sender || !args.recipient || !args.content) {
              return {
                isError: true,
                content: [{ type: 'text', text: 'Error: "sender", "recipient", and "content" are required for "send" action.' }],
              };
            }
            const msg = mailbox.send(
              args.sender as AgentId,
              args.recipient as any,
              args.subject || 'Message',
              args.content
            );
            return {
              content: [
                {
                  type: 'text',
                  text: `✅ Message sent to \`${args.recipient.toUpperCase()}\` [ID: \`${msg.id}\`].`,
                },
              ],
            };
          }

          case 'check': {
            const recipient = (args.recipient as AgentId) || 'claude';
            const msgs = mailbox.getMessagesFor(recipient);
            if (msgs.length === 0) {
              return {
                content: [{ type: 'text', text: `📬 No messages waiting for agent \`${recipient.toUpperCase()}\`.` }],
              };
            }

            const lines = [
              `### 📬 Inbox for \`${recipient.toUpperCase()}\` (${msgs.length} message(s))\n`,
              '| ID | From | Subject | Status | Timestamp |',
              '| :--- | :--- | :--- | :--- | :--- |',
            ];

            for (const m of msgs) {
              const status = m.read ? '⚪ Read' : '🟢 **UNREAD**';
              lines.push(`| \`${m.id}\` | **${m.sender.toUpperCase()}** | ${m.subject} | ${status} | ${m.timestamp} |`);
            }

            return {
              content: [{ type: 'text', text: lines.join('\n') }],
            };
          }

          case 'read': {
            if (!args.message_id) {
              return {
                isError: true,
                content: [{ type: 'text', text: 'Error: "message_id" is required for "read" action.' }],
              };
            }
            const msg = mailbox.readMessage(args.message_id);
            if (!msg) {
              return {
                isError: true,
                content: [{ type: 'text', text: `Message with ID "${args.message_id}" not found.` }],
              };
            }

            const formatted = [
              `### ✉️ Message: ${msg.subject}`,
              `- **From:** \`${msg.sender.toUpperCase()}\``,
              `- **To:** \`${msg.recipient.toUpperCase()}\``,
              `- **Date:** \`${msg.timestamp}\``,
              '',
              '---',
              msg.content,
            ].join('\n');

            return {
              content: [{ type: 'text', text: formatted }],
            };
          }

          case 'list': {
            const all = mailbox.listAll();
            if (all.length === 0) {
              return {
                content: [{ type: 'text', text: '📭 Mailbox is empty.' }],
              };
            }

            const rows = [
              `### 📬 All Mailbox Messages (${all.length})\n`,
              '| ID | From | To | Subject | Status | Timestamp |',
              '| :--- | :--- | :--- | :--- | :--- | :--- |',
            ];

            for (const m of all) {
              const status = m.read ? '⚪ Read' : '🟢 **UNREAD**';
              rows.push(`| \`${m.id}\` | **${m.sender.toUpperCase()}** | **${m.recipient.toUpperCase()}** | ${m.subject} | ${status} | ${m.timestamp} |`);
            }

            return {
              content: [{ type: 'text', text: rows.join('\n') }],
            };
          }

          case 'clear': {
            const count = mailbox.clear();
            return {
              content: [{ type: 'text', text: `🗑️ Cleared ${count} message(s) from mailbox.` }],
            };
          }
        }
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `⚠️ **Mailbox Error:** ${err.message}` }],
        };
      }
    }
  );
}
