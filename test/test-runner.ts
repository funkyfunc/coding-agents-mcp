import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverPath = path.resolve(__dirname, '../dist/index.js');

async function runTests() {
  console.log('🧪 Starting upgraded agy-mcp stateful connection test suite...');
  console.log(`Server script: ${serverPath}`);

  const transport = new StdioClientTransport({
    command: 'node',
    args: [serverPath],
    env: {
      ...process.env,
    },
  });

  const client = new Client(
    { name: 'test-client', version: '1.2.0' },
    { capabilities: {} }
  );

  try {
    await client.connect(transport);
    console.log('✅ Connected to agy-mcp over StdioClientTransport');

    // 1. Test listTools
    console.log('\n--- 1. Testing listTools ---');
    const toolsResult = await client.listTools();
    const toolNames = toolsResult.tools.map((t) => t.name);
    console.log('Discovered tools:', toolNames);

    const expectedTools = [
      'agy_task',
      'agy_ask',
      'agy_diff',
      'agy_sessions',
      'agy_reset',
      'agy_run_task',
      'agy_chat',
      'agy_plan',
      'agy_list_models',
      'agy_version',
    ];

    for (const expected of expectedTools) {
      if (!toolNames.includes(expected)) {
        throw new Error(`Missing expected tool: ${expected}`);
      }
    }
    console.log('✅ All 10 tools registered (including agy_reset)');

    // 2. Test implicit multi-turn continuity (ZERO session_id passed!)
    console.log('\n--- 2. Testing implicit multi-turn continuity (No session_id passed) ---');
    const turn1Result = await client.callTool(
      {
        name: 'agy_task',
        arguments: {
          prompt: 'Remember this secret phrase: SILVER_FALCON_ALPHA',
          workspace_dir: path.resolve(__dirname, '..'),
          tier: 'fast',
          include_diff: false,
        },
      },
      undefined,
      { timeout: 120000 }
    );
    const turn1Text = (turn1Result.content[0] as any).text;
    console.log('Turn 1 Output:');
    console.log(turn1Text);

    // Call Turn 2 with NO session_id passed at all!
    console.log('\n--- Turn 2 (No session_id passed) ---');
    const turn2Result = await client.callTool(
      {
        name: 'agy_task',
        arguments: {
          prompt: 'What was the secret phrase I asked you to remember in our previous turn?',
          workspace_dir: path.resolve(__dirname, '..'),
          tier: 'fast',
          include_diff: false,
        },
      },
      undefined,
      { timeout: 120000 }
    );
    const turn2Text = (turn2Result.content[0] as any).text;
    console.log('Turn 2 Output:');
    console.log(turn2Text);

    if (!turn2Text.includes('SILVER_FALCON_ALPHA')) {
      throw new Error('Implicit multi-turn continuity failed to recall secret phrase');
    }
    console.log('✅ Zero-config multi-turn continuity verified successfully!');

    // 3. Test dedicated stateless one-off (agy_ask)
    console.log('\n--- 3. Testing dedicated stateless one-off (agy_ask) ---');
    const askResult = await client.callTool(
      {
        name: 'agy_ask',
        arguments: {
          prompt: 'In one sentence, what is a binary search tree?',
          tier: 'fast',
        },
      },
      undefined,
      { timeout: 120000 }
    );
    const askText = (askResult.content[0] as any).text;
    console.log(askText);
    if (!askText.includes('One-off (Stateless)')) {
      throw new Error('agy_ask did not execute as One-off (Stateless)');
    }
    console.log('✅ agy_ask one-off verified successfully!');

    // 4. Test friendly session alias routing
    console.log('\n--- 4. Testing friendly session alias routing ---');
    const aliasResult = await client.callTool(
      {
        name: 'agy_task',
        arguments: {
          session_id: 'frontend-worker',
          prompt: 'You are the frontend worker. Acknowledge with: FRONTEND_WORKER_ONLINE',
          workspace_dir: path.resolve(__dirname, '..'),
          tier: 'fast',
          include_diff: false,
        },
      },
      undefined,
      { timeout: 120000 }
    );
    const aliasText = (aliasResult.content[0] as any).text;
    console.log(aliasText);
    if (!aliasText.includes('FRONTEND_WORKER_ONLINE')) {
      throw new Error('Friendly session alias task failed');
    }

    // Inspect sessions list
    const sessionsListResult = await client.callTool({
      name: 'agy_sessions',
      arguments: { action: 'list' },
    });
    const sessionsListText = (sessionsListResult.content[0] as any).text;
    console.log('\nSessions list output:');
    console.log(sessionsListText);
    if (!sessionsListText.includes('frontend-worker')) {
      throw new Error('Alias frontend-worker was not recorded in sessions list');
    }
    console.log('✅ Friendly session alias verified successfully!');

    // 5. Test agy_reset (Clearing active connection state)
    console.log('\n--- 5. Testing agy_reset tool ---');
    const resetResult = await client.callTool({
      name: 'agy_reset',
      arguments: {},
    });
    console.log((resetResult.content[0] as any).text);
    console.log('✅ agy_reset completed');

    // 6. Test that next task after reset begins fresh
    console.log('\n--- 6. Testing fresh conversation after reset ---');
    const postResetResult = await client.callTool(
      {
        name: 'agy_task',
        arguments: {
          prompt: 'Do you remember the secret phrase from our earlier conversation, or is this a new conversation?',
          workspace_dir: path.resolve(__dirname, '..'),
          tier: 'fast',
          include_diff: false,
        },
      },
      undefined,
      { timeout: 120000 }
    );
    const postResetText = (postResetResult.content[0] as any).text;
    console.log('Post-Reset Output:');
    console.log(postResetText);

    if (postResetText.includes('SILVER_FALCON_ALPHA')) {
      throw new Error('agy_reset did not detach conversation state; secret phrase was remembered!');
    }
    console.log('✅ Fresh conversation boundary after reset verified successfully!');

    console.log('\n🎉 ALL CONNECTION STATE & LIFECYCLE TESTS PASSED! 🎉\n');
  } finally {
    await client.close();
  }
}

runTests().catch((err) => {
  console.error('\n❌ Test failed with error:', err);
  process.exit(1);
});
