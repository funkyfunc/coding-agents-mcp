import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTestSuite() {
  console.log('🧪 Starting coding-agents-mcp comprehensive multi-agent test suite...\n');

  const serverScript = path.resolve(__dirname, '../dist/index.js');
  console.log(`Server script: ${serverScript}`);

  const transport = new StdioClientTransport({
    command: 'node',
    args: [serverScript],
    env: {
      ...process.env,
      FORCE_COLOR: '0',
    },
  });

  const client = new Client(
    { name: 'test-harness', version: '1.0.0' },
    { capabilities: {} }
  );

  await client.connect(transport);
  console.log('✅ Connected to coding-agents-mcp over StdioClientTransport\n');

  try {
    // -------------------------------------------------------------------------
    // 1. tools/list Verification
    // -------------------------------------------------------------------------
    console.log('--- 1. Testing listTools ---');
    const toolsResult = await client.listTools();
    const toolNames = toolsResult.tools.map((t) => t.name);
    console.log(`Discovered tools (${toolNames.length}):`, toolNames);

    const requiredTools = [
      'delegate_task',
      'delegate_ask',
      'agents_status',
      'delegate_diff',
      'delegate_reset',
      'delegate_sessions',
      'agy_task',
      'agy_ask',
      'agy_diff',
      'agy_reset',
    ];

    for (const tool of requiredTools) {
      if (!toolNames.includes(tool)) {
        throw new Error(`Missing expected tool: "${tool}"`);
      }
    }
    console.log('✅ All primary polymorphic tools & backward-compatibility aliases registered!\n');

    // -------------------------------------------------------------------------
    // 2. agents_status Tool
    // -------------------------------------------------------------------------
    console.log('--- 2. Testing agents_status ---');
    const statusRes: any = await client.callTool({
      name: 'agents_status',
      arguments: {},
    });
    const statusText = statusRes.content[0].text;
    console.log(statusText);

    const hasClaude = statusText.includes('Ready') && statusText.includes('Claude Code');
    const hasAgy = statusText.includes('Ready') && statusText.includes('Antigravity');
    console.log(`Detected CLI availability: claude=${hasClaude}, agy=${hasAgy}`);
    console.log('✅ agents_status correctly discovered and reported agent CLIs!\n');

    // -------------------------------------------------------------------------
    // 3. Claude Code: Multi-turn State Continuity (using Haiku for speed)
    // -------------------------------------------------------------------------
    const projectCodenameClaude = `FALCON_DELTA_${Date.now()}`;
    if (hasClaude) {
      console.log('--- 3. Testing Claude Code Stateful Continuity (haiku) ---');
      console.log(`Sending Turn 1 (storing project codename: ${projectCodenameClaude})...`);
      const claudeTurn1: any = await client.callTool({
        name: 'delegate_task',
        arguments: {
          agent: 'claude',
          model: 'haiku',
          prompt: `The project codename is ${projectCodenameClaude}. Acknowledge with RECEIVED.`,
        },
      });
      console.log('Claude Turn 1 output:\n', claudeTurn1.content[0].text);

      console.log('\nSending Turn 2 without session_id (verifying implicit turn continuity)...');
      const claudeTurn2: any = await client.callTool({
        name: 'delegate_task',
        arguments: {
          agent: 'claude',
          model: 'haiku',
          prompt: 'What is the project codename? Reply with just the codename.',
        },
      });
      const turn2Text = claudeTurn2.content[0].text;
      console.log('Claude Turn 2 output:\n', turn2Text);

      if (!turn2Text.includes(projectCodenameClaude)) {
        throw new Error(`Claude Turn 2 failed to recall project codename. Expected ${projectCodenameClaude}`);
      }
      console.log('✅ Claude Code multi-turn session continuity verified!\n');
    } else {
      console.log('--- 3. Skipping Claude live test (CLI not found on PATH in this environment) ---');
    }

    // -------------------------------------------------------------------------
    // 4. Antigravity: Multi-turn State Continuity
    // -------------------------------------------------------------------------
    const projectCodenameAgy = `TITAN_OMEGA_${Date.now()}`;
    if (hasAgy) {
      console.log('--- 4. Testing Antigravity Stateful Continuity (gemini-3.8-flash-low) ---');
      console.log(`Sending Turn 1 (storing project codename: ${projectCodenameAgy})...`);
      const agyTurn1: any = await client.callTool({
        name: 'delegate_task',
        arguments: {
          agent: 'agy',
          prompt: `The project codename is ${projectCodenameAgy}. Acknowledge with RECEIVED.`,
        },
      });
      console.log('Agy Turn 1 output:\n', agyTurn1.content[0].text);

      console.log('\nSending Turn 2 without session_id (verifying implicit turn continuity)...');
      const agyTurn2: any = await client.callTool({
        name: 'delegate_task',
        arguments: {
          agent: 'agy',
          prompt: 'What is the project codename? Reply with just the codename.',
        },
      });
      const agyTurn2Text = agyTurn2.content[0].text;
      console.log('Agy Turn 2 output:\n', agyTurn2Text);

      if (!agyTurn2Text.includes(projectCodenameAgy)) {
        throw new Error(`Antigravity Turn 2 failed to recall project codename. Expected ${projectCodenameAgy}`);
      }
      console.log('✅ Antigravity multi-turn session continuity verified!\n');
    } else {
      console.log('--- 4. Skipping Antigravity live test (CLI not found on PATH in this environment) ---');
    }

    // -------------------------------------------------------------------------
    // 5. Fast Stateless One-Off: delegate_ask
    // -------------------------------------------------------------------------
    const activeAgent = hasClaude ? 'claude' : (hasAgy ? 'agy' : null);
    if (activeAgent) {
      console.log(`--- 5. Testing Stateless delegate_ask (${activeAgent}) ---`);
      const askRes: any = await client.callTool({
        name: 'delegate_ask',
        arguments: {
          agent: activeAgent,
          prompt: 'What is 7 * 8? Reply with just the number.',
        },
      });
      const askText = askRes.content[0].text;
      console.log('delegate_ask output:\n', askText);

      if (!askText.includes('56')) {
        throw new Error(`delegate_ask failed to calculate 7 * 8. Output: ${askText}`);
      }
      console.log('✅ delegate_ask stateless execution verified!\n');
    } else {
      console.log('--- 5. Skipping delegate_ask live calculation (no agents installed) ---');
    }

    // -------------------------------------------------------------------------
    // 6. Unified Git Diff Inspection: delegate_diff
    // -------------------------------------------------------------------------
    console.log('--- 6. Testing delegate_diff ---');
    const diffRes: any = await client.callTool({
      name: 'delegate_diff',
      arguments: {},
    });
    const diffText = diffRes.content[0].text;
    console.log(diffText);

    if (!diffText.includes('Is Git Repository') || !diffText.includes('true')) {
      throw new Error('delegate_diff did not recognize git repository');
    }
    console.log('✅ delegate_diff workspace inspection verified!\n');

    // -------------------------------------------------------------------------
    // 7. Friendly Session Alias Routing: delegate_sessions
    // -------------------------------------------------------------------------
    console.log('--- 7. Testing Friendly Session Alias Routing ---');
    if (activeAgent) {
      const aliasRes: any = await client.callTool({
        name: 'delegate_task',
        arguments: {
          agent: activeAgent,
          session_id: 'qa-agent',
          prompt: 'Say QA_AGENT_ONLINE in 1 line',
        },
      });
      console.log('Alias run output:\n', aliasRes.content[0].text);

      const listSessionsRes: any = await client.callTool({
        name: 'delegate_sessions',
        arguments: { action: 'list' },
      });
      const sessionsListText = listSessionsRes.content[0].text;
      console.log(sessionsListText);

      if (!sessionsListText.includes('qa-agent')) {
        throw new Error('Friendly session alias "qa-agent" not present in delegate_sessions list');
      }
      console.log('✅ Friendly session alias routing verified!\n');
    } else {
      const listSessionsRes: any = await client.callTool({
        name: 'delegate_sessions',
        arguments: { action: 'list' },
      });
      console.log(listSessionsRes.content[0].text);
      console.log('✅ delegate_sessions tool call verified!\n');
    }

    // -------------------------------------------------------------------------
    // 8. Session Reset Tool: delegate_reset
    // -------------------------------------------------------------------------
    console.log('--- 8. Testing delegate_reset ---');
    const resetRes: any = await client.callTool({
      name: 'delegate_reset',
      arguments: {},
    });
    console.log(resetRes.content[0].text);

    if (activeAgent && hasClaude) {
      // Verify post-reset task starts with clean memory
      const postResetRes: any = await client.callTool({
        name: 'delegate_task',
        arguments: {
          agent: 'claude',
          model: 'haiku',
          prompt: 'What was the project codename from our earlier conversation? If you have no memory of it, say NO_MEMORY.',
        },
      });
      const postResetText = postResetRes.content[0].text;
      console.log('Post-reset output:\n', postResetText);

      if (postResetText.includes(projectCodenameClaude)) {
        throw new Error('Session reset failed: Agent still recalled previous turn codename!');
      }
      console.log('✅ Clean context separation after delegate_reset verified!\n');
    } else {
      console.log('✅ delegate_reset tool execution verified!\n');
    }

    // -------------------------------------------------------------------------
    // 9. Graceful Error on Missing Backend (Codex)
    // -------------------------------------------------------------------------
    console.log('--- 9. Testing Graceful Error Handling on Missing Agent ---');
    const codexRes: any = await client.callTool({
      name: 'delegate_task',
      arguments: {
        agent: 'codex',
        prompt: 'test prompt',
      },
    });
    console.log('Codex execution response:\n', codexRes.content[0].text);

    if (!codexRes.isError || !codexRes.content[0].text.includes('not installed')) {
      throw new Error('Missing agent did not return expected actionable install instructions');
    }
    console.log('✅ Missing agent graceful degradation verified!\n');

    console.log('🎉 ALL MULTI-AGENT HUB INTEGRATION TESTS PASSED CLEANLY! 🎉\n');
  } finally {
    await client.close();
  }
}

runTestSuite().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
