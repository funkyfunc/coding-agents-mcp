# coding-agents-mcp

### Universal Model Context Protocol (MCP) gateway & orchestrator for autonomous AI coding agents: Claude Code, Antigravity, Codex, and Cursor.

[![CI](https://github.com/funkyfunc/coding-agents-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/funkyfunc/coding-agents-mcp/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/coding-agents-mcp)](https://www.npmjs.com/package/coding-agents-mcp)
[![license](https://img.shields.io/npm/l/coding-agents-mcp)](./LICENSE)

`coding-agents-mcp` is an **Agent Hypervisor** and universal gateway for autonomous CLI coding agents. It enables AI supervisors, IDEs (Cursor, Windsurf), and desktop assistants (Claude Desktop, Google Antigravity) to orchestrate local coding agents—including **Anthropic Claude Code (`claude`)**, **Google Antigravity (`agy`)**, **OpenAI Codex (`codex`)**, and **Cursor Agent (`cursor`)**.

---

## 💡 Why coding-agents-mcp?

1. **The Agent Hypervisor Paradigm**: Instead of wrapping 50+ brittle CLI flags in rigid schemas, `coding-agents-mcp` provides a goal-oriented substrate. Supervising models dictate **intent, invariants, and acceptance criteria**; subordinate agents execute micro-decisions (reading files, writing code, running linters) autonomously.
2. **Ephemeral Git Worktree Sandboxing**: Execute agent runs in isolated, detached worktrees (`.git/agent-worktrees/<alias>`) on dedicated branches. Eliminates uncommitted file churn and `.git/index.lock` contention. Merge or discard changes with a single tool call.
3. **Connection-Scoped Stateful Sessions**: Automatically preserves multi-turn conversation memory across calls with **zero token wire overhead**.
4. **Inter-Agent Handoffs & Mailbox**: Transfer tasks across different models (e.g. Claude Code $\rightarrow$ Antigravity) using structured packets (objectives, file manifests, git diffs) instead of raw conversational transcripts, preventing context window explosion.
5. **Native Multi-Agent Orchestration Pipelines**: Built-in declarative topologies (`architect_builder`, `peer_review`, `custom` DAGs) with automatic rollback and per-stage git diff verification.
6. **Process Safety & Zombie Reaping**: Sub-process trees are registered with a unified process reaper that monitors parent `stdin` and OS signals (`SIGINT`, `SIGTERM`, `SIGHUP`) to guarantee zero orphan background processes.

---

## 🛠️ Complete Toolset Reference

### 1. Core Delegation & Inspection

#### `delegate_task`
Autonomous pair programming with your chosen CLI coding agent.
- `agent`: `"auto"` (picks best installed), `"agy"`, `"claude"`, `"codex"`, `"cursor"`
- `prompt`: The coding instruction, bug fix, or refactor request. Follows contract-first formatting (Goal, Invariants, Acceptance Criteria).
- `session_id`: Optional session ID or friendly alias (e.g., `"frontend-refactor"`, `"ci-worker"`). Automatically maintains turn-by-turn context.
- `isolate_worktree`: `boolean` — If `true`, runs the task in an isolated ephemeral Git worktree.
- `model`: Explicit model selection (`"haiku"`, `"sonnet"`, `"opus"` for Claude; `"gemini-3.8-flash-low"`, `"gemini-3.1-pro"` for Antigravity).
- `thinking`: Thinking effort level (`"low"`, `"medium"`, `"high"`, `"xhigh"`, `"max"`).
- `mode`: `"edit"` (writes code) | `"plan"` (architectural dry run) | `"explain"` (read-only query).
- `include_diff`: Appends a clean git diff patch of modified files.
- `agent_options`: Bag for agent-specific passthrough options (`agy.effort`, `agy.skills`, `agy.rules`, `claude.customFlags`).

#### `delegate_ask`
Stateless, read-only query or quick calculation without modifying active session state.

#### `delegate_diff`
Workspace git diff inspector returning modified files, insertions, deletions, and unified patch without modifying the working tree.

#### `agents_status`
Auto-discovers and reports installed CLI versions, locations, and a **Deep Capabilities Matrix** (modes, thinking support, worktree isolation, sandboxing).

---

### 2. Session & Workspace Sandboxing

#### `delegate_sessions`
Inspect or manage active conversation sessions.
- `action`: `"list"` (tabular view of active sessions, turns, tokens, last active), `"inspect"`, `"delete"`.
- `agent`: Optional agent filter (`"claude"`, `"agy"`).
- `session_id`: Session ID or friendly alias.

#### `delegate_reset`
Resets active conversation sessions, guaranteeing clean context separation for subsequent turns.
- `agent`: Optional agent filter (`"claude"`, `"agy"`, or all if omitted).
- `session_id`: Optional specific session to reset.

#### `delegate_worktree`
Manages ephemeral Git worktree sandboxes.
- `action`: `"list"` (view all active sandboxes), `"inspect"`, `"merge"` (squash/merge branch into main workspace), `"discard"` (remove directory and delete branch).
- `alias`: The unique worktree identifier.

---

### 3. Orchestration & Inter-Agent Messaging

#### `delegate_pipeline`
Orchestrates multi-agent pipelines with automatic worktree isolation and rollback.
- `pipeline_name`: Friendly pipeline identifier (e.g., `"auth-refactor"`).
- `topology`:
  - `"architect_builder"`: Claude (plan) designs specification $\rightarrow$ Antigravity (edit) implements $\rightarrow$ Claude (explain) verifies diff.
  - `"peer_review"`: Author agent implements code $\rightarrow$ Reviewer agent critiques diff.
  - `"custom"`: User-defined stages with mustache interpolation (`{{stages.<id>.output}}`, `{{current_diff}}`).
- `prompt`: The overarching pipeline objective.
- `isolate_worktree`: `boolean` (default `true`). Runs the entire pipeline in an ephemeral worktree.
- `custom_stages`: Array of custom stage definitions for `"custom"` topology.

#### `delegate_handoff`
Performs a structured task handoff between two coding agents without context window pollution.
- `from_agent`: Source agent (`"claude"`, `"agy"`, etc.).
- `to_agent`: Destination agent.
- `objective`: High-level goal.
- `instructions`: Specific guidance for the receiving agent.
- `target_mode`: `"edit"` | `"plan"` | `"explain"`.

#### `agent_mailbox`
Asynchronous in-memory message board for cross-agent coordination.
- `action`: `"send"`, `"check"`, `"read"`, `"list"`, `"clear"`.
- `sender`: Sender agent identifier.
- `recipient`: Recipient agent identifier.
- `subject`: Message subject line.
- `content`: Message body.

---

## 📋 Supervisor Prompt Templates

`coding-agents-mcp` advertises 5 standard MCP prompt templates designed for high-performance agent-to-agent delegation:

| Prompt Name | Purpose | Key Arguments |
| :--- | :--- | :--- |
| `supervisor_delegate_contract` | Formulates goal-driven, invariant-enforced contracts | `task_goal`, `hard_invariants`, `acceptance_criteria`, `preferred_agent` |
| `evaluator_code_critique` | Evaluator-Optimizer diff critique and regression analysis | `contract_goal`, `git_diff`, `acceptance_criteria` |
| `agent_handoff_template` | Compact cross-model handoff packet | `source_agent`, `target_agent`, `objective`, `decisions_summary`, `diff_patch` |
| `architect_builder_plan` | System design prompt for architect-builder pipelines | `task_description`, `constraints` |
| `peer_review_critique` | Diff inspection prompt for peer review stages | `task_description`, `implementation_summary`, `diff_patch` |

---

## 📦 Quick Start

Run directly via `npx`:

```bash
npx -y coding-agents-mcp
```

### Configuration

#### Claude Desktop (`claude_desktop_config.json`)
```json
{
  "mcpServers": {
    "coding-agents": {
      "command": "npx",
      "args": ["-y", "coding-agents-mcp"]
    }
  }
}
```

#### Cursor (`~/.cursor/mcp.json`)
```json
{
  "mcpServers": {
    "coding-agents": {
      "command": "npx",
      "args": ["-y", "coding-agents-mcp"]
    }
  }
}
```

#### Google Antigravity Sidecar (`~/.gemini/antigravity-cli/mcp.json`)
```json
{
  "mcpServers": {
    "coding-agents": {
      "command": "npx",
      "args": ["-y", "coding-agents-mcp", "--compat=agy"]
    }
  }
}
```

#### Optional CLI Flags
```bash
# Filter available agents
npx -y coding-agents-mcp --agents=claude,agy

# Enable legacy agy_* backward-compatible tool aliases
npx -y coding-agents-mcp --compat=agy
```

---

## 💻 Supported CLI Agents

| Agent | CLI Binary | Status | Default Engine |
| :--- | :--- | :--- | :--- |
| **Anthropic Claude Code** | `claude` | Supported | Claude 3.5 Haiku / Claude 3.7 Sonnet |
| **Google Antigravity** | `agy` | Supported | Gemini 3.8 Flash / Gemini 3.1 Pro |
| **OpenAI Codex CLI** | `codex` | Adapter Ready | GPT-4o / o3-mini |
| **Cursor Agent** | `cursor` | Adapter Ready | Cursor Agent |

---

## 🧪 Development & Testing

```bash
# Clone the repository
git clone https://github.com/funkyfunc/coding-agents-mcp.git
cd coding-agents-mcp

# Install dependencies
npm install

# Build TypeScript
npm run build

# Run end-to-end integration test suite (13 test phases)
npm test

# Validate MCP protocol compliance
npx run-mcp validate --deep -- node dist/index.js
```

---

## 🚀 Releasing

Publishing to npm runs automatically in CI via npm **trusted publishing (OIDC)** when a version tag (`v*`) is pushed. See [RELEASING.md](./RELEASING.md) for details and one-time setup.

---

## 📄 License

MIT © [funkyfunc](https://github.com/funkyfunc)
