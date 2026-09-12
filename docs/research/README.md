# Research Archives: The Agent Hypervisor in Autonomous Software Engineering

This directory archives foundational research, theoretical proofs, empirical vulnerability evaluations, and protocol specifications that guide the architecture of `coding-agents-mcp`.

---

## 📚 Document Index

1. **[External Deep Research Report: Architectural Axioms and Theoretical Foundations](agent-hypervisors-deep-research.md)**  
   *Authoritative theoretical and distributed systems analysis.*
   - Mathematical modeling of token degradation dynamics (scaled dot-product attention dilution, RoPE "Lost in the Middle" bias).
   - Generative Communication via Linda Tuple Spaces (`out`, `in`, `rd`) vs Actor Model vs Synchronous Cascading RPC.
   - Historical protocol lineage: LSP $\rightarrow$ DAP $\rightarrow$ MCP $\rightarrow$ ACP $\rightarrow$ A2A.
   - Quantitative latency and overhead tradeoffs across sandboxing tiers (Ephemeral Git Worktrees, Bubblewrap/Seatbelt, Docker, gVisor, Firecracker).
   - 52 industry and academic citations (SWE-bench Verified, CVE-2026-55607, Liu et al., Gelernter 1985).

2. **[RFC-0089: Agent Hypervisor & Agent Execution Packets (AEP)](rfc-0089-agent-hypervisor-and-aep.md)**  
   *Formal architectural specification and RFC standard for inter-agent delegation.*
   - 7-State Lifecycle State Machine: `PROPOSED` $\rightarrow$ `ACCEPTED` $\rightarrow$ `EXECUTING` $\rightarrow$ `EVALUATING` $\rightarrow$ `COMPLETED` / `REJECTED` / `ABORTED`.
   - Formal JSON Schema for Agent Execution Packets (AEP v1.0.0).
   - Objective Contract Invariants (`IMMUTABLE_FILE`, `MAX_DIFF_LINES`, `FORBIDDEN_AST_NODE`, `PRESERVE_TEST_PASS`).
   - Unified Git diff verification and atomic fast-forward merge protocol.

3. **[Master Research Specification & Prompt](research-specification-and-prompt.md)**  
   *The 5-vector deep research prompt and hypothesis framework.*
   - Vector A: The "Agent Hypervisor" vs. Monolithic Endpoints.
   - Vector B: Inter-Agent Communication Protocols & Context Attention Dynamics.
   - Vector C: Contract-First Delegation vs. Procedural Micromanagement.
   - Vector D: Sandboxing, Process Lifecycle, and Security Guarantees.
   - Vector E: Dynamic Introspection & Managed Passthrough.

---

## 🧭 Theoretical Axioms Informing `coding-agents-mcp`

### 1. The Agent Hypervisor Hypothesis
Monolithic wrappers that statically model dozens of upstream vendor flags suffer from the **Red Queen's Race**—constant upstream churn, breakage, and context window bloat. Conversely, raw unmanaged bash runners lead to orphaned processes, `.git/index.lock` collisions, and security vulnerabilities.

The **Type-2 Agent Hypervisor** provides the optimal substrate:
- The hypervisor enforces **OS-level and repository-level invariants** (ephemeral Git worktrees, process group reaping, double-dash argument boundaries, hook sanitization).
- The guest coding agent retains **complete local reasoning autonomy** (file exploration, code editing, test running, compiler error correction).
- Dynamic feature discovery is achieved through live `--help` introspection ([`agent_help`](../../src/tools/help.ts)) and sanitized passthrough arrays (`raw_args`).

### 2. Context Window Mathematics: Quadratic Transcripts vs. Linear State Packets
Forwarding turn-by-turn conversational histories across multi-agent pipelines scales quadratically $\Theta(N^2 \bar{T})$. Distractor interference and RoPE positional bias degrade information retrieval by over 30% in turns 5–55.

By replacing conversational forwarding with **Agent Execution Packets (AEP)** carrying structured objectives, test invariants, and unified Git diffs:
- Context scaling drops from $\Theta(N^2 \bar{T})$ to linear $\Theta(N \bar{\Delta})$.
- Token payload is compressed by **95.5%**.
- Distractor interference from failed repair attempts is eliminated.

### 3. Cross-Platform Simplicity as an Architectural Invariant
We reject fragile OS-specific virtualization silos (macOS Seatbelt/`sandbox-exec`, Linux cgroups v2, Docker container daemons). Instead, `coding-agents-mcp` enforces isolation and safety using **universal, 100% portable primitives**:
- Ephemeral Git Worktrees (`git worktree add -b`) with Git config overrides (`-c core.fsmonitor=false -c core.hooksPath="" -c core.longpaths=true`).
- Standard process group termination (`killProcessTree`) via POSIX negative PGID (`process.kill(-pid)`) on Unix and `taskkill /pid ${pid} /T /F` on Windows.
- Pure in-memory Levenshtein edit distance and SHA-256 rolling diff hash sets for AST stagnation and oscillation circuit breakers.
