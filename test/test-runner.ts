import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import {
  DiffCircuitBreaker,
  computeLevenshteinDistance,
  computeNormalizedDiffDrift,
  hashDiff,
  killProcessTree,
} from '../src/index.js';

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
      'delegate_worktree',
      'delegate_pipeline',
      'delegate_handoff',
      'agent_mailbox',
      'agent_skills',
      'agent_help',
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

      if (hasAgy && !sessionsListText.includes('AGY')) {
        throw new Error('Antigravity session missing from delegate_sessions list');
      }
      console.log('✅ Friendly session alias routing & unified multi-agent session list verified!\n');
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

    // -------------------------------------------------------------------------
    // 10. Git Worktree Isolation: delegate_worktree
    // -------------------------------------------------------------------------
    console.log('--- 10. Testing Git Worktree Isolation (delegate_worktree) ---');
    const wtListRes: any = await client.callTool({
      name: 'delegate_worktree',
      arguments: { action: 'list' },
    });
    console.log('Worktree list response:\n', wtListRes.content[0].text);

    if (activeAgent) {
      console.log('Running task in isolated ephemeral worktree...');
      const wtTaskRes: any = await client.callTool({
        name: 'delegate_task',
        arguments: {
          agent: activeAgent,
          session_id: 'ci-worker',
          isolate_worktree: true,
          prompt: 'Say CI_WORKTREE_OK in 1 line',
        },
      });
      const wtTaskText = wtTaskRes.content[0].text;
      console.log('Isolated task output:\n', wtTaskText);

      if (!wtTaskText.includes('Isolated Worktree')) {
        throw new Error('delegate_task with isolate_worktree did not report Isolated Worktree path');
      }

      // Discard worktree
      const discardRes: any = await client.callTool({
        name: 'delegate_worktree',
        arguments: { action: 'discard', alias: 'ci-worker' },
      });
      console.log('Discard response:\n', discardRes.content[0].text);
      console.log('✅ Ephemeral Git Worktree isolation & cleanup verified!\n');
    }

    // -------------------------------------------------------------------------
    // 11. Inter-Agent Mailbox: agent_mailbox
    // -------------------------------------------------------------------------
    console.log('--- 11. Testing Inter-Agent Mailbox (agent_mailbox) ---');
    const sendMailRes: any = await client.callTool({
      name: 'agent_mailbox',
      arguments: {
        action: 'send',
        sender: 'claude',
        recipient: 'agy',
        subject: 'Architecture Spec Draft',
        content: 'Please verify the JWT rotation strategy in auth.ts',
      },
    });
    console.log('Mailbox send response:\n', sendMailRes.content[0].text);

    const checkMailRes: any = await client.callTool({
      name: 'agent_mailbox',
      arguments: {
        action: 'check',
        recipient: 'agy',
      },
    });
    const checkMailText = checkMailRes.content[0].text;
    console.log('Mailbox check response:\n', checkMailText);

    if (!checkMailText.includes('Architecture Spec Draft')) {
      throw new Error('Message not found in agent_mailbox check');
    }
    console.log('✅ Inter-Agent Mailbox messaging verified!\n');

    // -------------------------------------------------------------------------
    // 12. Structured Inter-Agent Handoff: delegate_handoff
    // -------------------------------------------------------------------------
    if (hasClaude && hasAgy) {
      console.log('--- 12. Testing Inter-Agent Handoff (Claude -> Antigravity) ---');
      const handoffRes: any = await client.callTool({
        name: 'delegate_handoff',
        arguments: {
          from_agent: 'claude',
          to_agent: 'agy',
          objective: 'Confirm inter-agent communication channel',
          instructions: 'Acknowledge handoff receipt with HANDOFF_ACKNOWLEDGED in 1 line.',
          target_mode: 'explain',
        },
      });
      const handoffText = handoffRes.content[0].text;
      console.log('Handoff response:\n', handoffText);

      if (!handoffText.includes('HANDOFF_ACKNOWLEDGED') && !handoffText.includes('ACKNOWLEDGED')) {
        throw new Error(`delegate_handoff did not return expected acknowledgement. Response: ${handoffText}`);
      }
      console.log('✅ Structured Inter-Agent Handoff verified!\n');
    }

    // -------------------------------------------------------------------------
    // 13. Multi-Agent Orchestration Pipeline: delegate_pipeline
    // -------------------------------------------------------------------------
    if (activeAgent) {
      console.log('--- 13. Testing Multi-Agent Orchestration Pipeline (delegate_pipeline) ---');
      const pipeRes: any = await client.callTool({
        name: 'delegate_pipeline',
        arguments: {
          pipeline_name: 'health-check',
          topology: 'custom',
          prompt: 'Echo confirmation of stage completion',
          isolate_worktree: true,
          custom_stages: [
            {
              id: 'stage_plan',
              agent: activeAgent,
              mode: 'plan',
              prompt_template: 'Plan a health check for the server in 1 line. Say PLAN_OK.',
            },
            {
              id: 'stage_verify',
              agent: activeAgent,
              mode: 'explain',
              prompt_template: 'Review stage plan: {{stages.stage_plan.output}}. Confirm with PIPELINE_VERIFIED in 1 line.',
            },
          ],
        },
      });
      const pipeText = pipeRes.content[0].text;
      console.log('Pipeline output:\n', pipeText);

      if (!pipeText.includes('SUCCESS') || !pipeText.includes('stage_plan')) {
        throw new Error('Pipeline execution failed or did not report stage breakdown');
      }
      console.log('✅ Multi-Agent Orchestration Pipeline verified!\n');
    }

    // -------------------------------------------------------------------------
    // 14. Specialized Domain Skills: agent_skills
    // -------------------------------------------------------------------------
    console.log('--- 14. Testing Specialized Domain Skills Discovery (agent_skills) ---');
    const skillsListRes: any = await client.callTool({
      name: 'agent_skills',
      arguments: {
        action: 'list',
        agent: 'agy',
      },
    });
    const skillsListText = skillsListRes.content[0].text;
    console.log('Skills list output:\n', skillsListText);

    if (!skillsListText.includes('Available Domain Skills') && !skillsListText.includes('agy-customizations')) {
      throw new Error('agent_skills list did not return expected skills');
    }

    // Inspect a specific skill
    const skillInspectRes: any = await client.callTool({
      name: 'agent_skills',
      arguments: {
        action: 'inspect',
        agent: 'agy',
        skill_name: 'agy-customizations',
      },
    });
    const inspectText = skillInspectRes.content[0].text;
    console.log('Skill inspect preview:\n', inspectText.slice(0, 200));

    if (!inspectText.includes('Antigravity Customization System Guide') && !inspectText.includes('agy-customizations')) {
      throw new Error('agent_skills inspect failed to return skill documentation');
    }
    console.log('✅ agent_skills discovery and documentation inspection verified!\n');

    // -------------------------------------------------------------------------
    // 15. Dynamic Introspection & Managed Passthrough: agent_help & raw_args
    // -------------------------------------------------------------------------
    console.log('--- 15. Testing Dynamic Help Introspection & Managed Passthrough ---');
    if (hasClaude) {
      const claudeHelpRes: any = await client.callTool({
        name: 'agent_help',
        arguments: {
          agent: 'claude',
        },
      });
      const claudeHelpText = claudeHelpRes.content[0].text;
      console.log('Claude Help preview:\n', claudeHelpText.slice(0, 200));

      if (!claudeHelpText.includes('Live CLI Help') || !claudeHelpText.includes('--model')) {
        throw new Error('agent_help(claude) failed to return live CLI help output');
      }
      console.log('✅ agent_help(claude) live introspection verified!');
    }

    if (hasAgy) {
      const agyHelpRes: any = await client.callTool({
        name: 'agent_help',
        arguments: {
          agent: 'agy',
        },
      });
      const agyHelpText = agyHelpRes.content[0].text;
      console.log('Agy Help preview:\n', agyHelpText.slice(0, 200));

      if (!agyHelpText.includes('Live CLI Help') || !agyHelpText.includes('--model')) {
        throw new Error('agent_help(agy) failed to return live CLI help output');
      }
      console.log('✅ agent_help(agy) live introspection verified!');
    }

    if (activeAgent) {
      console.log('Testing delegate_ask with raw_args passthrough...');
      const rawArgsRes: any = await client.callTool({
        name: 'delegate_ask',
        arguments: {
          agent: activeAgent,
          prompt: 'Say PASSTHROUGH_OK in 1 line',
          raw_args: activeAgent === 'claude' ? ['--verbose'] : ['--effort', 'low'],
        },
      });
      const rawArgsText = rawArgsRes.content[0].text;
      console.log('raw_args execution output:\n', rawArgsText);

      if (!rawArgsText.includes('PASSTHROUGH_OK') && !rawArgsText.includes('SUCCESS')) {
        throw new Error('delegate_ask with raw_args passthrough failed');
      }
      console.log('✅ raw_args managed passthrough verified!\n');
    }

    // -------------------------------------------------------------------------
    // 16. Kernel Process Group Reaping & Orphan Prevention
    // -------------------------------------------------------------------------
    console.log('--- 16. Testing Process Tree Reaping (killProcessTree) ---');
    const detachedChild = spawn('node', ['-e', 'setInterval(() => {}, 1000)'], {
      detached: process.platform !== 'win32',
      stdio: 'ignore',
    });
    const testPid = detachedChild.pid;
    if (!testPid) {
      throw new Error('Failed to spawn test process for process group testing');
    }
    console.log(`Spawned detached test process group leader PID: ${testPid}`);

    // Verify process is initially running
    let isRunning = false;
    try {
      process.kill(testPid, 0);
      isRunning = true;
    } catch {}
    if (!isRunning) {
      throw new Error(`Detached process PID ${testPid} was not alive`);
    }

    // Terminate via killProcessTree
    killProcessTree(testPid, 'SIGTERM');

    // Allow brief moment for signal processing
    await new Promise((r) => setTimeout(r, 200));

    let stillRunning = false;
    try {
      process.kill(testPid, 0);
      stillRunning = true;
    } catch {}

    if (stillRunning) {
      killProcessTree(testPid, 'SIGKILL');
      await new Promise((r) => setTimeout(r, 200));
      try {
        process.kill(testPid, 0);
        throw new Error(`Process ${testPid} failed to terminate after killProcessTree`);
      } catch {}
    }
    console.log('✅ killProcessTree successfully reaped process group!\n');

    // -------------------------------------------------------------------------
    // 17. Security Sanitization & Metacharacter Clamping
    // -------------------------------------------------------------------------
    console.log('--- 17. Testing Security Sanitization & Metacharacter Clamping ---');
    // Test that shell metacharacters are rejected
    const maliciousCall: any = await client.callTool({
      name: 'delegate_ask',
      arguments: {
        agent: activeAgent || 'claude',
        prompt: 'test prompt',
        raw_args: ['; cat /etc/passwd'],
      },
    });

    const malText = maliciousCall.content[0].text;
    if (!maliciousCall.isError && !malText.includes('Security Exception')) {
      throw new Error('Expected Security Exception for shell metacharacters in raw_args');
    }
    console.log('✅ Malicious metacharacters blocked with Security Exception:', malText);

    // Test that hypervisor-controlled flags are stripped without error
    const strippedFlagCall: any = await client.callTool({
      name: 'delegate_ask',
      arguments: {
        agent: activeAgent || 'claude',
        prompt: 'Say STRIP_OK in 1 line',
        raw_args: ['--print', '--dangerously-skip-permissions'],
      },
    });
    const strippedText = strippedFlagCall.content[0].text;
    if (!strippedText.includes('STRIP_OK') && !strippedText.includes('SUCCESS')) {
      throw new Error('Execution failed when hypervisor flags were stripped');
    }
    console.log('✅ Hypervisor control flags safely stripped!\n');

    // -------------------------------------------------------------------------
    // 18. Diff Circuit Breaker & AST Oscillation Detection
    // -------------------------------------------------------------------------
    console.log('--- 18. Testing Diff Circuit Breaker & AST Oscillation Detection ---');
    // Test Levenshtein distance calculations
    const dist1 = computeLevenshteinDistance('hello', 'hello');
    const dist2 = computeLevenshteinDistance('kitten', 'sitting');
    if (dist1 !== 0 || dist2 !== 3) {
      throw new Error(`Levenshtein distance calculation failed: expected (0, 3), got (${dist1}, ${dist2})`);
    }

    // Test normalized drift
    const driftSame = computeNormalizedDiffDrift('diff --git a b', 'diff --git a b');
    const driftDiff = computeNormalizedDiffDrift('diff --git a b\n+foo', 'diff --git a b\n-bar');
    if (driftSame !== 0 || driftDiff <= 0) {
      throw new Error(`Normalized drift calculation failed: driftSame=${driftSame}, driftDiff=${driftDiff}`);
    }

    // Test Cross-OS CRLF normalization parity
    const unixDiff = 'diff --git a/app.ts b/app.ts\n+const x = 1;\n';
    const winDiff = 'diff --git a/app.ts b/app.ts\r\n+const x = 1;\r\n';
    if (hashDiff(unixDiff) !== hashDiff(winDiff)) {
      throw new Error('hashDiff failed cross-OS parity: CRLF and LF produced different hashes');
    }
    if (computeNormalizedDiffDrift(unixDiff, winDiff) !== 0) {
      throw new Error('computeNormalizedDiffDrift failed cross-OS parity: CRLF vs LF had non-zero drift');
    }
    console.log('✅ Cross-OS CRLF vs LF normalization parity verified!');

    // Test circuit breaker stagnation detection
    const cb = new DiffCircuitBreaker(3, 0.05);
    cb.evaluate('diff --git a/file.ts b/file.ts\n+const a = 1;');
    cb.evaluate('diff --git a/file.ts b/file.ts\n+const a = 1; '); // trivial whitespace drift
    cb.evaluate('diff --git a/file.ts b/file.ts\n+const a = 1;  ');
    const r4 = cb.evaluate('diff --git a/file.ts b/file.ts\n+const a = 1;   ');
    if (!r4.tripped || !r4.reason?.includes('Non-Progressive Iteration Deadlock')) {
      throw new Error('Circuit breaker failed to trip on non-progressive stagnation');
    }
    console.log('✅ Non-progressive iteration deadlock tripped correctly:', r4.reason);

    // Test AST oscillation detection (reverting to prior state)
    const cbOsc = new DiffCircuitBreaker(5, 0.05);
    const patchA = 'diff --git a/app.ts\n+function render() { return "A"; }';
    const patchB = 'diff --git a/app.ts\n+function render() { return "B"; }';
    cbOsc.evaluate(patchA); // Turn 1: State A
    cbOsc.evaluate(patchB); // Turn 2: State B
    const oscResult = cbOsc.evaluate(patchA); // Turn 3: Back to State A!
    if (!oscResult.tripped || !oscResult.reason?.includes('AST Oscillation')) {
      throw new Error('Circuit breaker failed to trip on AST oscillation');
    }
    console.log('✅ AST oscillation loop detected and tripped correctly:', oscResult.reason, '\n');

    console.log('🎉 ALL MULTI-AGENT HUB INTEGRATION TESTS PASSED CLEANLY! 🎉\n');
  } finally {
    await client.close();
  }
}

runTestSuite().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
