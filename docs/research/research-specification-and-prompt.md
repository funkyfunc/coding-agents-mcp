# Deep Research Specification & Master Prompt: Agent Hypervisors & Multi-Agent Delegation

## Goal Description

Provide a production-grade, highly structured **Master Research Prompt** for a Deep Research Agent (e.g. Gemini Deep Research, OpenAI Deep Research, or an autonomous research subagent). 

The goal of this research mission is to rigorously stress-test the foundational assumptions, architectural axioms, and inter-agent communication protocols of `coding-agents-mcp` against cutting-edge academic literature, industry benchmarks, and distributed systems theory.

---

## 1. Executive Framing: What We Are Stress-Testing

`coding-agents-mcp` has established a distinctive architectural thesis:
> **The Core Thesis:**  
> A universal gateway for autonomous CLI coding agents should **not** act as a static feature wrapper (chasing 50+ brittle CLI flags across vendors). Instead, it must act as an **Agent Hypervisor**:
> 1. Establishing **Contract-First Delegation** (Goals + Invariants + Acceptance Tests).
> 2. Providing **Managed Sandboxing & Safety** (Ephemeral Git Worktrees + Process Reaper Tree Killing).
> 3. Enforcing **Semantic Handoffs** (transferring objective Git diffs and file manifests instead of dumping token-heavy conversational transcripts).
> 4. Empowering **Autonomous Introspection & Managed Passthrough** (`agent_help` + `raw_args`), allowing supervising LLMs to self-discover and use upstream CLI features on day zero without gateway code changes.

We now require an exhaustive, academic-grade research investigation to identify blind spots, analyze competing paradigms, and validate our inter-agent coordination model.

---

## 2. The Master Deep Research Prompt

Below is the verbatim prompt ready to be copied into a Deep Research Agent:

````markdown
# MISSION: Deep Architectural & Theoretical Research on Autonomous Agent Hypervisors and Heterogeneous Multi-Agent Delegation

You are a Principal Distributed Systems Architect and Senior AI Systems Researcher specializing in autonomous multi-agent software engineering systems (MAS-SE), tool hypervisors, and agent communication protocols.

Your objective is to conduct an exhaustive, rigorous, and evidence-backed deep research investigation into the architecture of **Agent Hypervisors for Autonomous CLI Coding Agents** (specifically Anthropic Claude Code, Google Antigravity, OpenAI Codex, and Cursor Agent).

---

### 1. SYSTEM CONTEXT & THE ARCHITECTURAL PROBLEM

Modern autonomous coding agents (`claude`, `agy`, `codex`, `cursor`) are complex, stateful, long-running processes that execute shell commands, edit source trees, run linters, and invoke internal subagents.

When building an orchestration gateway (e.g., an MCP server) that coordinates multiple heterogeneous coding agents, systems designers encounter two classic failure modes:
1. **The Red Queen's Race (The Brittle Wrapper Antipattern)**:
   Attempting to model and wrap every vendor-specific CLI flag (`--compact`, `--effort`, `--skills`, `--sandbox`, `--fast-apply`) in rigid schemas. This creates severe maintenance debt, constant breaking changes with weekly upstream CLI updates, and context window pollution for the supervising LLM.
2. **The Wild West (The Unmanaged Bash Antipattern)**:
   Letting the orchestrating agent invoke the raw agent binary directly in bash (`claude ...`, `cursor ...`). While flexible, this leads to catastrophic reliability failures: orphan zombie processes locking CPU/ports upon timeouts, dirty working tree collisions and `.git/index.lock` contention, total loss of connection-scoped turn memory, lack of objective Git diff extraction, and no standardized token telemetry.

To solve this, our project (`coding-agents-mcp`) implements the **"Agent Hypervisor" Paradigm**:
- **Layer 1 (Contract-First Universal Substrate)**: Orchestrators dictate *Goal, Invariants, and Acceptance Criteria*. Downstream micro-decisions (file searching, editing, linter fixing) are black-box and autonomous; they are never escalated to the supervisor.
- **Layer 2 (Ephemeral Git Worktree Sandboxing)**: Subordinate runs execute in isolated detached git worktrees (`.git/agent-worktrees/<alias>`) on private branches, with atomic merge or discard.
- **Layer 3 (Semantic Handoff & Asynchronous Mailbox)**: Inter-agent task transfers pass compact structured packets (objective + file manifest + unified git diff) rather than raw conversational transcripts.
- **Layer 4 (Managed Passthrough & Autonomous Introspection)**: An `agent_help` tool allows the supervising agent to dynamically inspect the live `--help` output of local binaries, and a `raw_args: string[]` parameter allows the agent to pass arbitrary flags directly through to the binary while remaining protected by the hypervisor's process reaper, worktree sandbox, and session store.

---

### 2. CORE RESEARCH VECTORS & INVESTIGATIVE QUESTIONS

Conduct deep literature review, empirical analysis, and systems evaluation across the following five research vectors:

#### Vector A: The "Agent Hypervisor" vs. Monolithic Endpoints (Abstraction Theory)
1. In the evolution of autonomous AI tools, is an intermediate "Agent Hypervisor" the optimal long-term architectural pattern, or is it an ephemeral stopgap?
2. Compare the Hypervisor Model to:
   - **Language Server Protocol (LSP)** / **Debug Adapter Protocol (DAP)**: What lessons from LSP/DAP standardization apply to agentic coding harnesses?
   - **Operating System Hypervisors (Type-1 vs Type-2)**: How closely does managing child agent processes parallel OS virtualization, scheduling, and capability domains?
3. What are the formal architectural boundaries between what the hypervisor *must own* (lifecycle, worktrees, signal reaping, diff verification) versus what it *must delegate* to the guest agent?

#### Vector B: Inter-Agent Communication Protocols & Context Degradation
1. **Raw Transcript vs. Structured State Packet**:
   - What does recent research (e.g., Anthropic, DeepMind, Stanford, Berkeley) say about context degradation, attention drift, and "lost-in-the-middle" phenomena when passing conversational history between heterogeneous models (e.g. Claude 3.7 Sonnet $\leftrightarrow$ Gemini 3.1 Pro $\leftrightarrow$ GPT-4o)?
   - How does our **Structured Handoff Packet** (Objective + Decisions Summary + File Manifest + Objective Git Diff Patch) compare to existing agent communication standards (FIPA-ACL, KQML, Actor Model message passing, AutoGen message graphs, OpenAI Swarm)?
2. **Synchronous RPC vs. Asynchronous Message Boards (Mailbox/Tuple Spaces)**:
   - What are the mathematical and empirical failure modes of synchronous cascading agent calls (deadlocks, timeout spirals, cascading errors)?
   - How effective are Linda-style Tuple Spaces, Blackboards, or mailbox queues for decoupling multi-agent coding workflows?

#### Vector C: Contract-First Delegation vs. Procedural Micromanagement
1. In empirical benchmarks (such as SWE-bench, HumanEval-Multi, or ChatDev experiments), how does **Goal & Invariant Delegation** (dictating *what* and *why* with strict invariants and acceptance tests) perform relative to **Procedural Prompting** (step-by-step file and line micromanagement)?
2. What are the known failure modes where an autonomous subordinate agent gets stuck in infinite self-correction loops when fixing linter errors or failing tests? What circuit-breaker mechanisms (e.g. turn limits, diff volatility thresholds) are proven in literature?

#### Vector D: Sandboxing, Process Lifecycle, and Security Guarantees
1. **Worktree Sandboxing vs. Containerization vs. MicroVMs**:
   - Evaluate the security, performance, and operational tradeoffs of:
     - Ephemeral Git Worktrees (`git worktree add/remove`)
     - Container Sandboxes (Docker, Podman, Bubblewrap)
     - Ephemeral MicroVMs (Firecracker, gVisor)
   - Can an untrusted or hallucinating agent break out of an ephemeral Git worktree? What are the specific attack vectors (e.g. `.git/config` hooks, symlink traversal, submodules, root workspace access), and how can a hypervisor harden against them?
2. **Process Tree Reaping**:
   - Why do modern CLI coding agents (Node, Python, native binaries) routinely spawn detached grandchild processes that evade standard Unix signal termination? What are the best practices in OS engineering (e.g. Linux cgroups, macOS process groups `setpgid`, Windows Job Objects) to guarantee 100% clean process teardown?

#### Vector E: Dynamic Introspection & Managed Passthrough
1. When AI orchestrators are given an introspection tool (`agent_help`) and a raw passthrough array (`raw_args`), what is their empirical accuracy in discovering and correctly formulating CLI invocations?
2. What are the security and prompt-injection implications of allowing an LLM orchestrator to dynamically compose raw CLI arguments for an underlying execution binary?

---

### 3. REQUIRED SOURCES & COMPARATIVE FRAMEWORKS

Your investigation should synthesize findings from:
1. **Academic Research**:
   - Multi-agent software engineering frameworks (ChatDev, MetaGPT, SWE-agent, AutoGen, CrewAI, LangGraph).
   - Agent evaluation benchmarks (SWE-bench, CodeXGLUE, HumanEval, AgentBench).
   - Context window dynamics and attention failure modes (Liu et al. *Lost in the Middle*, Anthropic *Contextual Retrieval & Compaction*).
2. **Industrial Architecture & Whitepapers**:
   - Anthropic (*Building Effective Agents*, Claude Code headless architecture).
   - OpenAI (*Swarm*, Operator, Codex evaluations).
   - Google DeepMind / Google Antigravity architecture.
   - Cursor Agent architecture and indexing whitepapers.
3. **Classical Systems Theory**:
   - Saltzer & Kaashoek's *Principles of Computer System Design* (End-to-End Principle, Fate-Sharing).
   - Hewitt's *Actor Model* of concurrent computation.
   - Gelernter's *Generative Communication (Tuple Spaces / Linda)*.

---

### 4. OUTPUT DELIVERABLE STRUCTURE

Deliver your findings in an exhaustive, structured research report with the following sections:

1. **Executive Summary & Verdict on the Agent Hypervisor Hypothesis**:
   - Direct assessment of our 4-layer hypervisor architecture.
2. **Theoretical Foundations: The Mathematics & Dynamics of Inter-Agent Delegation**:
   - Token degradation analysis: Transcripts vs. Semantic Diffs.
   - Coordination dynamics: Actor Model vs. Tuple Spaces vs. Synchronous RPC.
3. **Comparative Evaluation Matrix**:
   - Comprehensive matrix comparing 5 approaches: Static CLI Wrapper, Raw Bash Runner, Actor Blackboard, Full Container Sandbox, and our Managed Hypervisor.
4. **Empirical Failure Modes & Vulnerability Analysis**:
   - The Top 7 failure modes in multi-agent coding delegation and how to defend against them (including infinite loops, hallucinated flags, and worktree symlink breakouts).
5. **Architectural Recommendations for `coding-agents-mcp`**:
   - Concrete, prioritized technical recommendations for v0.4.0 and v1.0.0 (protocols, circuit breakers, sandboxing enhancements, and dynamic discovery optimizations).
6. **Formal RFC Specification Proposal**:
   - A proposed open specification for **Agent Execution Packets (AEP)**: a standard JSON schema for inter-agent task delegation and worktree diff transfers.
````

---

## 3. User Review Required

> [!IMPORTANT]
> **Scope & Precision**:
> This prompt is engineered to produce an authoritative, peer-reviewed-level systems report. It forces the research agent to confront the real engineering tradeoffs (process groups, git worktree escape vectors, attention degradation in multi-turn transcripts, and standardizing agent hypervisors).

---

## 4. Open Questions & Usage Options

1. **Execution Target**: Would you like to run this research prompt:
   - Directly using an external deep research tool (e.g. Gemini Deep Research or OpenAI Deep Research)?
   - Or would you like us to invoke our internal `research` subagent right now to run a preliminary literature scan and codebase analysis?
2. **Specific Focus Areas**: Are there any additional proprietary harnesses or internal tools (e.g. internal CI/CD bots, cloud sandboxes like Modal or E2B) you want added to the research prompt before you dispatch it?

---

## 5. Verification Plan

### Automated Verification
- Verify that the markdown artifact renders cleanly without broken syntax, fences, or unescaped characters.
- Ensure all repository file references link to the actual implemented components.

### Manual Verification
- Review the prompt prompt text to confirm it aligns with your architectural vision for `coding-agents-mcp`.
