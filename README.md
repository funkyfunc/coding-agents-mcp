# coding-agents-mcp

### Universal Model Context Protocol (MCP) gateway for autonomous AI coding agents: Claude Code, Antigravity, Codex, and Cursor.

[![CI](https://github.com/funkyfunc/coding-agents-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/funkyfunc/coding-agents-mcp/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/coding-agents-mcp)](https://www.npmjs.com/package/coding-agents-mcp)
[![license](https://img.shields.io/npm/l/coding-agents-mcp)](./LICENSE)

`coding-agents-mcp` allows AI orchestrators, IDEs (Cursor, Windsurf), and desktop assistants (Claude Desktop) to delegate complex, multi-turn coding tasks to local CLI coding agents—including **Anthropic Claude Code (`claude`)**, **Google Antigravity (`agy`)**, **OpenAI Codex (`codex`)**, and **Cursor Agent (`cursor`)**.

---

## 💡 Why coding-agents-mcp?

1. **Zero Tool Bloat (Polymorphic Design)**: Instead of installing 4 separate MCP servers that flood your LLM context with 20+ tools, `coding-agents-mcp` provides **4 clean polymorphic tools**.
2. **Stateful Connection-Scoped Memory**: Maintains conversation context across turns automatically with **zero token overhead** passed across the wire.
3. **Multi-Vendor Model Arbitrage**: Route quick fixes to low-latency models (Gemini Flash) and complex refactoring to deep reasoning models (Claude 3.7 Sonnet Thinking).
4. **Process Safety & Zombie Reaping**: Listens to parent process `stdin` termination and standard signals (`SIGINT`, `SIGTERM`, `SIGHUP`) to immediately kill orphan background child processes.
5. **Non-Destructive Git Inspection**: Returns file change lists and unified git diff patches without executing destructive git checkouts.

---

## 🛠️ Core Tools

### 1. `delegate_task`
Autonomous pair programming with your chosen CLI coding agent.
- `agent`: `"auto"` (picks best installed), `"agy"`, `"claude"`, `"codex"`, `"cursor"`
- `prompt`: The coding instruction, bug fix, or refactor request
- `session_id`: Optional session ID or friendly name (e.g., `"frontend-refactor"`). Automatically maintains turn-by-turn context.
- `model`: Explicit model selection (`"haiku"`, `"sonnet"`, `"opus"` for Claude; `"gemini-3.8-flash-low"`, `"gemini-3.1-pro"` for Antigravity)
- `thinking`: Thinking effort level (`"low"`, `"medium"`, `"high"`, `"xhigh"`, `"max"`)
- `mode`: `"edit"` (writes code) | `"plan"` (architectural dry run) | `"explain"` (read-only query)
- `include_diff`: Appends a clean git diff patch of modified files

### 2. `delegate_ask`
Stateless, read-only query or review without modifying active conversation state.

### 3. `delegate_diff`
Unified workspace git diff inspector (branch status, modified files, line additions/deletions, patch).

### 4. `agents_status`
Auto-discovers and reports installed CLI versions, locations, and authentication status.

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
| **Google Antigravity** | `agy` | Supported | Gemini 3.8 Flash / Gemini 3.1 Pro |
| **Anthropic Claude Code** | `claude` | Supported | Claude 3.5 Haiku / Claude 3.7 Sonnet |
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

# Run end-to-end integration test suite
npm test
```

---

## 🚀 Releasing

Publishing to npm runs automatically in CI via npm **trusted publishing (OIDC)** when a version tag (`v*`) is pushed. See [RELEASING.md](./RELEASING.md) for details and one-time setup.

---

## 📄 License

MIT © [funkyfunc](https://github.com/funkyfunc)
