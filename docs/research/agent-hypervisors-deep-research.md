# **Architectural Axioms and Theoretical Foundations of Agent Hypervisors in Multi-Agent Software Engineering**

## **Executive Summary and Verdict on the Agent Hypervisor Hypothesis**

The rapid evolution of autonomous command-line interface (CLI) coding agents—such as Anthropic Claude Code, OpenAI Codex CLI, Google Antigravity, and Cursor Agent—has introduced severe architectural strains into modern software development environments1. Engineering teams attempting to orchestrate these stateful, long-running systems typically encounter two opposing architectural antipatterns.

The first failure mode is the *Brittle Static Wrapper*, which attempts to wrap and model dozens of vendor-specific CLI flags into static schemas1. This creates high maintenance overhead, constant breakage from upstream CLI updates, and context window pollution in the supervising model5.

The second failure mode is the *Unmanaged Bash Runner*, which allows orchestrators to execute raw shell commands directly2. While flexible, this leads to system instability: orphaned grandchild processes holding system resources, git lock contention, loss of session continuity, untracked filesystem mutations, and vulnerability to prompt injection attacks6.

To resolve this dilemma, coding-agents-mcp implements the **Agent Hypervisor** paradigm. This architecture coordinates heterogeneous autonomous agents across four operational layers:

> 1. **Contract-First Universal Substrate**: Orchestrators specify high-level goals, invariant constraints, and deterministic acceptance tests, leaving intermediate reasoning and micro-edits entirely to the subordinate agent10.  
> 2. **Ephemeral Git Worktree Sandboxing**: Guest agent runs execute in isolated, detached git worktrees on private branches, ensuring modifications are merged or discarded atomically11.  
> 3. **Semantic Handoff and Asynchronous Mailbox**: Inter-agent communication transfers structured state packets—containing task contracts, touched file manifests, and unified git diffs—instead of raw, token-heavy conversation logs13.  
> 4. **Managed Passthrough and Autonomous Introspection**: An introspection tool (agent\_help) enables dynamic discovery of binary flags, while a sanitized passthrough array (raw\_args) allows orchestrators to adopt new upstream features immediately without wrapper code updates1.

An analysis grounded in distributed systems theory, the End-to-End Principle, and operating system virtualization confirms that the Agent Hypervisor is a necessary long-term architectural pattern rather than an ephemeral stopgap5. Centralizing micro-reasoning across diverse coding subtasks leads to context window dilution and attention degradation17. Conversely, unmanaged decentralized execution causes process resource contention and fate-sharing16.

By decoupling high-level intent arbitration from local loop execution, the Agent Hypervisor functions as a Type-2 virtualization layer for autonomous software engineering. Its operational viability depends on enforcing kernel-level process isolation, strict filesystem canonicalization, and rigorous argument sanitization to prevent confused-deputy exploits6.

## **Theoretical Foundations: The Mathematics and Dynamics of Inter-Agent Delegation**

### **Token Degradation Dynamics: Transcripts Versus Semantic State Packets**

Passing raw, turn-by-turn conversational histories between heterogeneous agent models leads to severe performance degradation. This decay stems from three compounding phenomena: attention dilution, lost-in-the-middle positional bias, and distractor interference17.

In transformer architectures, scaled dot-product attention computes normalized weights across a context of length ![][image1]:

![][image2]

As an unmanaged conversation accumulates intermediate tool executions, compiler warnings, and terminal chatter, ![][image1] expands rapidly. The denominator ![][image3] grows monotonically, diluting the attention weight allocated to critical specification tokens17. The effective signal-to-noise ratio:

![][image4]

decays toward zero as operational noise dominates the context17. Empirical evaluations across frontier models confirm that performance drops substantially as context size increases: GPT-4 accuracy declines from 96.6% to 81.2% between 4K and 128K context tokens, while LLaMA-3.1-70B drops from 96.5% to 66.6%17.

Rotary position embeddings (RoPE) introduce an inductive bias favoring the start and end of sequences, creating a "lost-in-the-middle" effect where retrieval accuracy drops by over 30% for information located in the central 10% to 90% of the context window17. In a multi-turn transcript of 60 turns, turns 5 through 55 fall into this depressed retrieval zone17.

Distractor interference exacerbates this: failed repair attempts, invalid hypotheses, and syntax errors remain in context, acting as misleading attractors that trap downstream models in cognitive deadlocks and unproductive iterations17.

The Agent Hypervisor addresses this by replacing raw transcript forwarding with **Semantic Handoff**. Rather than transmitting the historical conversation trace:

![][image5]

the hypervisor generates an objective state packet:

![][image6]

In this structure, ![][image7] represents the functional goal, ![][image8] the invariant constraints, ![][image9] the touched file manifest, ![][image10] the unified diff against the common ancestor commit, and ![][image11] the deterministic test telemetry14.

By discarding intermediate operational chatter and retaining only objective workspace deltas, semantic handoffs reduce context growth from quadratic expansion ![][image12] to bounded updates ![][image13], preserving high signal-to-noise ratios and mitigating distractor interference13.

### **Coordination Topologies: Actor Model, Tuple Spaces, and Synchronous Cascades**

Multi-agent coordination architectures rely on three main operational patterns: Synchronous Remote Procedure Calls (RPC), Actor Model Direct Message Passing, and Generative Communication via Linda-style Tuple Spaces13.

Synchronous RPC architectures link caller and callee lifecycles directly:

![][image14]

This coupling creates tight fate-sharing, violating core fault-isolation principles16. The probability of catastrophic cascade failure scales exponentially with delegation depth ![][image15]:

![][image16]

If an intermediate agent hangs on an un-sandboxed command or enters an infinite linter loop, the entire supervisory chain deadlocks20.

The Actor Model isolates state within independent computational entities that communicate through asynchronous point-to-point mailboxes13. Frameworks like Ray and Dapr implement virtual actors to achieve high density and fast cold starts13. However, point-to-point actor messaging requires managing ![][image17] interface bindings and leaves systems vulnerable to message flooding, race conditions, and livelocks when multiple agents coordinate over shared repository branches13.

Generative Communication, pioneered by Gelernter in the Linda coordination language, decouples communicating systems across both space and time22. Spatial decoupling ensures agents operate without awareness of peer network locations, process identifiers, or underlying model architectures22. Temporal decoupling allows interacting agents to execute asynchronously at different times22.

Coordination is mediated by an associative tuple space using three atomic primitives: out(tuple) writes a tuple into the shared space, in(template) atomically reads and removes a matching tuple, and rd(template) reads a matching tuple without removing it22.

For agent hypervisors, an associative tuple space—implemented via durable state stores like LangGraph channels or SQLite-backed task queues—eliminates synchronous RPC failure modes13. Subordinate workers consume task contracts independently, acquire worktree leases, and output verified diff tuples without direct peer coupling18.

### **Standardization Lineage: LSP, DAP, MCP, ACP, and A2A**

The structural decomposition of AI software engineering harnesses mirrors the historic evolution of IDE tooling protocols, transitioning from bespoke integrations to standardized protocols5.

&nbsp;

| Protocol | Governance Body | Architectural Domain | Wire Format | Core Primitives and Abstractions |
| :---- | :---- | :---- | :---- | :---- |
| **LSP** (Language Server Protocol)5 | Microsoft / Open Source | Editor ![][image18] Static Language Intelligence | JSON-RPC 2.0 over stdio/TCP | Document symbols, semantic tokens, diagnostics, AST navigation5 |
| **DAP** (Debug Adapter Protocol)14 | Microsoft / Open Source | Editor ![][image18] Runtime Execution Debuggers | JSON-RPC 2.0 over stdio/TCP | Breakpoints, stack frames, thread management, step evaluation14 |
| **MCP** (Model Context Protocol)5 | Agentic AI Foundation (Linux Foundation) | Agent ![][image18] External Tools and Static Context | JSON-RPC 2.0 over stdio/SSE | Resources, tools, prompt templates, reverse model sampling5 |
| **ACP** (Agent Client Protocol)14 | Zed / JetBrains | Workspace Editor ![][image18] Embedded Coding Agent | JSON-RPC 2.0 over stdio | Sessions, turn streaming, buffer mutation reviews, permissions14 |
| **A2A** (Agent-to-Agent)15 | Agentic AI Foundation (Linux Foundation) | Autonomous Agent ![][image18] Autonomous Agent | JSON-RPC 2.0 / gRPC over HTTP | Agent Cards, asynchronous Task state machines, artifacts, parts15 |

The Agent Hypervisor in coding-agents-mcp bridges these industry specifications14. While MCP standardizes synchronous client-to-tool integration, it lacks primitives for asynchronous, long-running agent reasoning14. ACP models the display of proposed changes inside human-interactive editor buffers14.

The Agent Hypervisor exposes an MCP interface to supervising orchestrators, enforces an ACP-style diff-review model within local version control, and orchestrates subprocess execution using an asynchronous, contract-first task lifecycle aligned with the A2A specification14.

### **Operating System Virtualization Analogies**

The architectural boundary between static tool wrappers and agent hypervisors parallels the distinction between Type-1 and Type-2 operating system hypervisors:

Type-1 hypervisors, such as Xen or bare-metal KVM, run directly on hardware to schedule physical resources and enforce hardware-isolated execution boundaries31. In multi-agent systems, this corresponds to isolated container or microVM platforms like Firecracker, where each agent executes within an independent kernel image31.

Type-2 hypervisors, such as VirtualBox or bhyve, operate within an existing host operating system, multiplexing underlying resources while presenting isolated execution environments to guest processes5. coding-agents-mcp functions as a Type-2 Agent Hypervisor. It executes on the host workstation, sharing host capabilities (such as the native compiler toolchain and git repository store) while isolating guest agent execution inside ephemeral, guarded workspaces5.

The formal separation of responsibilities requires the hypervisor to manage process lifecycles, signal propagation, filesystem worktrees, path canonicalization, and diff verification6. In contrast, the guest agent retains autonomy over internal search trajectories, AST exploration, file editing, and test execution6.

## **Comparative Evaluation Matrix**

The following matrix compares five software engineering orchestration architectures across primary distributed systems criteria:

&nbsp;

| Evaluation Dimension | Static CLI Wrapper | Raw Bash Runner | Actor Blackboard | Full Container Sandbox | Managed Agent Hypervisor |
| :---- | :---- | :---- | :---- | :---- | :---- |
| **Protocol Maintenance Overhead** | High: Schemas require frequent updates to track vendor CLI flags1 | Minimal: Shell command strings passed directly to execution tools2 | Moderate: Requires maintaining state schemas and interaction transitions13 | High: Requires maintaining Dockerfiles, base images, and runtime mounts33 | Low: Managed passthrough and help introspection track upstream changes1 |
| **Filesystem Isolation & Safety** | Low: Edits execute in the primary checkout, risking tree contamination6 | Unsafe: Scripts run directly on host with arbitrary write permissions6 | Moderate: Soft application barriers unless paired with external containers18 | High: Namespaces and layered storage prevent host file mutations35 | High: Ephemeral git worktrees isolate changes on dedicated branches6 |
| **Process Lifecycle Management** | Poor: Standard process kills fail to clean up detached worker daemons7 | Critical: Grandchild processes routinely orphan and lock ports7 | Moderate: Thread lifecycle managed by runtime; child binaries unmonitored7 | High: Container engine terminates the entire container lifecycle atomically33 | Complete: cgroups v2 and process groups eliminate orphaned child processes7 |
| **Context Window Efficiency** | Moderate: Schemas structure parameters but retain operational output9 | Poor: Full terminal chatter and error logs flood context17 | High: Typed state channels and blackboard reducers bound token usage13 | Neutral: Context usage depends on supervisor prompting strategy17 | Optimal: Semantic handoffs transfer only file manifests and diffs14 |
| **Subordinate Agent Autonomy** | Low: Rigid procedural steps limit downstream reasoning10 | Unmanaged: Model operations run without invariant boundaries8 | Moderate: Execution bound to predefined agent roles and transitions13 | High: Full execution freedom within container filesystem12 | Balanced: Contract-first goals allow local exploration within invariants10 |
| **Upstream Feature Agility** | Zero: Features unavailable until explicit wrapper patches ship5 | Instant: New vendor flags can be executed immediately2 | Low: Adapters must be updated to expose new agent parameters13 | Moderate: Requires rebuilding container images with updated agent binaries36 | Day-Zero: Autonomous discovery exposes new CLI flags dynamically1 |

While the Raw Bash Runner offers immediate feature access, its lack of isolation introduces severe stability and security risks6. Full Container Sandboxes provide strong isolation but introduce significant cold-start latency and operational overhead33.

The Managed Hypervisor delivers a balanced operational model: sub-15ms initialization, strong filesystem isolation via ephemeral worktrees, automated process tree reclamation, and resilient feature passthrough1.

## **Empirical Failure Modes and Vulnerability Analysis**

A review of execution traces from SWE-bench evaluations, industrial deployments, and security advisories highlights seven critical failure modes in multi-agent coding workflows6.

&nbsp;

| Failure Mode | Root Trigger & Causal Mechanism | Observable Behavioral Fingerprint | Hypervisor Defense Mechanism |
| :---- | :---- | :---- | :---- |
| **1\. Non-Progressive Iteration** \[cite: 20\] | Context attractor states; model attends to its own failed repair attempts17. | Cyclic file edits with trivial token modifications (![][image19] variation)20. | Semantic Volatility Circuit Breaker tracking AST and Levenshtein diff drift20. |
| **2\. Evasive Repair & Masking** \[cite: 20, 21\] | Goal specification failure; agent prioritizes suppressing errors over correctness20. | Wrapping code in catch-all exceptions; modifying or removing tests20. | Invariant Diff Guard rejecting forbidden AST nodes and unauthorized test edits21. |
| **3\. Incomplete Propagation** \[cite: 40, 42\] | Context horizon collapse; agent limits reasoning to the initial target file40. | Core API changes pass local unit tests, but dependent call sites break40. | Symbol Graph Verifier checking touched symbols across the broader repository40. |
| **4\. Symlink Boundary Escape** \[cite: 6, 11\] | Early path evaluation without runtime symlink canonicalization11. | Agent writes to paths traversing into $HOME or reserved .git/ files6. | Strict realpath() boundary validation and reserved metadata blacklisting6. |
| **5\. Tool Git Redirection** \[cite: 11\] | Filesystem isolation bypassed by internal CLI path override flags11. | Git commands invoked with git \-C, \--git-dir, or GIT\_DIR targeting root11. | Environment variable scrubbing and command flag AST inspection11. |
| **6\. Orphan Process Leaks** \[cite: 7, 24\] | Child daemons detach via setsid() or subprocess pools, evading signals7. | High CPU/memory consumption; ports and .git/index.lock remain held7. | Atomic process group reclamation via cgroups v2 cgroup.kill or POSIX killpg7. |
| **7\. Dynamic Flag Injection** \[cite: 8, 12\] | Indirect prompt injection in untrusted code turns model into a confused deputy8. | Ingestion of dangerous flags like \--dangerously-skip-permissions or \--eval1. | Strict POSIX argument partitioning, double-dash separation, and capability clamping8. |

In non-progressive iteration cycles, autoregressive self-attention causes the model to focus increasingly on its recent failed attempts, trapping it in repetitive, unconstructive edits17. The hypervisor monitors progress by computing the normalized Levenshtein drift between successive iterations:

![][image20]

If ![][image21] for three consecutive turns, the hypervisor halts execution, reverts the worktree, and notifies the supervisor of the stall20.

Evasive repairs occur when models optimize for passing error checks rather than fixing underlying faults, often wrapping failing logic in broad try-except Exception: pass blocks or deleting test assertions20. The hypervisor guards against this by inspecting output diffs with tree-sitter AST queries, rejecting patches that alter test suites or introduce blanket exception handling20.

Incomplete propagation frequently surfaces in complex refactoring tasks, where models successfully alter an interface but fail to update its usage sites across dependent files40. The hypervisor analyzes the patch with local language server symbols, identifying orphaned references across the codebase and prompting the agent to update remaining call sites40.

Filesystem escapes, such as those documented in CVE-2026-55607 and CVE-2024-32002, exploit symlinks to write files outside the intended project root6. The hypervisor enforces path resolution through realpath(), verifying that the destination resides entirely within the sandbox before executing any git commands11.

Similarly, tool-level redirection attacks using flags like git \-C or environment variables like GIT\_DIR are prevented by sanitizing the execution environment and stripping override parameters11.

Process leaks caused by child daemons detaching into independent process sessions are resolved using Linux cgroups v27. Writing 1 to cgroup.kill atomically terminates all processes in the control group, avoiding the races common to manual PID traversal7.

Finally, indirect prompt injections targeting dynamic arguments are mitigated by using execve with strict argument parsing, enforcing double-dash (--) boundaries, and stripping blacklisted override flags8.

## **Systems Architecture: Sandboxing, Lifecycle, and Passthrough**

### **Sandboxing Mechanics: Tradeoff Analysis**

Securing autonomous agent execution requires balancing isolation strength, initialization latency, and filesystem performance31.

&nbsp;

| Sandboxing Mechanism | Core Isolation Primitive | Initialization Latency | Runtime Overhead | Escape Attack Surface | Operational Footprint |
| :---- | :---- | :---- | :---- | :---- | :---- |
| **Ephemeral Git Worktrees** \[cite: 11\] | Filesystem branch pointers | ![][image22] | **Zero**: Direct native execution | High: Unrestricted host access, symlinks, hook scripts6 | Low: Requires only standard git CLI binaries11 |
| **Bubblewrap / Seatbelt** \[cite: 35, 36, 45\] | Unprivileged Linux namespaces, seccomp, macOS Seatbelt | ![][image22] \[cite: 39\] | ![][image23]: Near-native system call performance39 | Low: Shared kernel, but prevents host filesystem escape35 | Low: Single binary utility; requires no system daemon33 |
| **Docker / Podman** \[cite: 33, 34\] | OCI Linux namespaces, cgroups, overlayfs storage | ![][image24] \[cite: 33, 34\] | Moderate: Overlayfs performance penalty on heavy I/O34 | Moderate: Misconfigurations, daemon vulnerabilities34 | High: Requires daemon services or rootless mapping33 |
| **gVisor (runsc)** \[cite: 31, 47\] | Userspace kernel system call interception (Go Sentry) | ![][image24] | High: ![][image25] syscall latency overhead (![][image26] vs ![][image27])47 | Very Low: System calls served by userspace kernel31 | Moderate: Custom container runtime configuration31 |
| **Firecracker MicroVM** \[cite: 31, 32\] | Hardware-assisted KVM virtualization | ![][image28] \[cite: 31, 36\] | Minimal: Hardware virtualization, 5MB memory floor31 | Minimal: Complete guest kernel isolation boundary31 | High: Requires bare-metal KVM virtualization access31 |

For developer workstations running coding-agents-mcp, combining **Ephemeral Git Worktrees with unprivileged Bubblewrap (Linux) and Seatbelt (macOS)** provides the optimal balance11. This configuration maintains sub-15ms startup latencies while eliminating the symlink traversal and host filesystem risks inherent to raw worktrees6.

### **Process Lifecycle and Kernel Teardown Mechanics**

Terminating misbehaving or timed-out agents requires handling multi-process fork hierarchies. Modern CLI agents written in TypeScript (Node.js) or Python frequently spin up child processes, worker pools, build daemons, and internal watchers7.

On Linux systems, the hypervisor manages processes using cgroups v27. Each session is assigned a dedicated control group:

/sys/fs/cgroup/coding\_agents\_hypervisor/session\_\<uuid\>

During initialization, the hypervisor writes the launcher PID to cgroup.procs, ensuring all descendant processes inherit group membership automatically7. When terminating a session, the hypervisor writes 1 to cgroup.kill, prompting the kernel to deliver SIGKILL to every process in the hierarchy simultaneously7. This eliminates PID recycling race conditions7. If cgroups v2 is unavailable, the hypervisor registers itself as an explicit process reaper using prctl(PR\_SET\_CHILD\_SUBREAPER, 1), catching orphaned grandchildren reparented when intermediate processes exit7.

On macOS and BSD environments, the hypervisor calls setpgid(0, 0\) in pre\_exec before executing the binary7. Termination dispatches SIGTERM across the process group using killpg(pgrp, SIGTERM), followed by SIGKILL if processes remain active after a grace period7.

On Windows hosts, processes are assigned to a Win32 Job Object configured with JOB\_OBJECT\_LIMIT\_KILL\_ON\_JOB\_CLOSE, ensuring the operating system automatically terminates all child processes when the hypervisor drops the job handle.

### **Autonomous Introspection and Managed Passthrough**

Vendor CLI tools evolve continuously, frequently adding parameters for model configuration, reasoning budgets, and tool definitions1. Rigid wrapper schemas quickly fall out of date5.

&nbsp;

| Agent CLI Binary | Headless Execution Flag | Output Serialization Mode | Unattended Permission Model | Context Continuity Flags |
| :---- | :---- | :---- | :---- | :---- |
| **Anthropic Claude Code** \[cite: 1, 2, 12\] | \-p, \--print \[cite: 2, 12\] | \--output-format json or stream-json \[cite: 1, 2\] | \--permission-mode \<mode\>, \--allowedTools \[cite: 1, 12\] | \--resume \<id\>, \--continue, \--fork-session \[cite: 1, 9\] |
| **OpenAI Codex CLI** \[cite: 2\] | codex exec (alias codex e)2 | \--json (Newline-delimited JSON stream)2 | \--sandbox \<policy\> (-s)2 | Thread-scoped session states2 |
| **Google Antigravity / Gemini CLI** \[cite: 2, 4\] | \-p, piped stdin stream2 | \--output-format json \[cite: 2\] | Pre-configured JSON policy file2 | Session-scoped hash indexing2 |
| **Cursor Agent** \[cite: 3, 52\] | \-p, \--print \[cite: 3\] | Terminal text / JSON stream bridge3 | \--force (alias \--yolo), \--approve-mcps \[cite: 3\] | Workspace trust tokens (--trust)3 |

The hypervisor manages this flexibility using a multi-stage argument pipeline:

* **Introspection via agent\_help**: The hypervisor invokes the CLI binary with \--help, strips formatting artifacts, caches the help text, and provides available flags to the supervising model1.  
* **Parameter Validation**: When receiving raw\_args from an orchestrator, the hypervisor removes internal control flags (-p, \--output-format, \--resume) to preserve control over the execution channel1.  
* **Security Scrubbing**: Dangerous parameters such as \--dangerously-skip-permissions or arbitrary evaluation commands are blocked to protect against prompt injection1.  
* **Execution Isolation**: The sanitized argument list is terminated with a double-dash separator (--) and dispatched directly to execve, ensuring argument values cannot be parsed as additional flags8.

## **Architectural Recommendations for coding-agents-mcp**

### **Milestone v0.4.0: Hardening and Isolation (Immediate Horizon)**

> 1. **Kernel-Level Process Isolation**: Implement cgroups v2 session management on Linux systems7. Subordinate agent processes must execute in dedicated child groups (session\_\<uuid\>) and be reaped via cgroup.kill on timeout7. For systems lacking cgroups, use prctl(PR\_SET\_CHILD\_SUBREAPER) and POSIX setpgid process group signaling as fallbacks7.  
> 2. **Worktree Path Canonicalization**: Enforce realpath() validation on all worktree targets prior to execution, blocking paths that resolve outside the project root or match reserved metadata directories6. Sanitize the environment by removing Git path override variables like GIT\_DIR and GIT\_WORK\_TREE11.  
> 3. **Execution Circuit Breakers**: Track iteration progress using AST and Levenshtein diff metrics20. Terminate runs that exhibit non-progressive cycles across consecutive turns, and reject patches that modify immutable test suites or introduce blanket exception handling20.

### **Milestone v1.0.0: Protocol Standardization and Production Maturity (Strategic Horizon)**

> 1. **Asynchronous Mailbox and Tuple Space Coordination**: Transition inter-agent coordination from synchronous RPC calls to an asynchronous state channel based on Linda Tuple Spaces13. Orchestrators publish immutable task contracts, while worker agents acquire workspace locks, execute tasks, and return verified patches without direct coupling18.  
> 2. **A2A Specification Alignment**: Standardize agent capability declarations to align with the Agentic AI Foundation's Agent-to-Agent (A2A) protocol29. Expose local CLI agents through machine-readable AgentCard schemas detailing supported tooling, token capacities, and execution profiles29.  
> 3. **Cryptographic Message Verification**: Secure communication channels by signing task packets and diff manifests using local Ed25519 keys18. The hypervisor verifies message provenance before applying changes, protecting the environment against lateral injection attacks across agent boundaries8.

## **Formal RFC Specification Proposal: Agent Execution Packets (AEP)**

### **RFC Metadata**

* **Title**: Agent Execution Packet (AEP) Specification for Heterogeneous Multi-Agent Software Engineering Delegation  
* **Status**: Proposed Standard  
* **Version**: 1.0.0  
* **Author**: coding-agents-mcp Architecture Group  
* **Layer**: Application / Inter-Agent Coordination Protocol

### **Abstract**

This specification defines the **Agent Execution Packet (AEP)**, a machine-readable, schema-validated protocol for delegating software engineering tasks between heterogeneous orchestrators and autonomous CLI subagents. AEP replaces turn-by-turn conversational transcript forwarding with an objective, contract-driven interface that encapsulates task goals, invariant constraints, ephemeral git worktree environments, and atomic git patches.

### **Packet Lifecycle State Machine**

An AEP task transitions through seven operational states:

> 1. PROPOSED: The orchestrator specifies the functional goal, file constraints, and verification tests10.  
> 2. ACCEPTED: The hypervisor validates the task schema, provisions an ephemeral worktree, and spawns the subordinate agent11.  
> 3. EXECUTING: The subordinate agent runs within the isolated worktree, navigating code, editing files, and running local builds30.  
> 4. EVALUATING: The hypervisor captures execution output, runs invariant checks, and compiles the unified diff21.  
> 5. COMPLETED: Invariant and acceptance tests pass; the patch is marked ready for merge30.  
> 6. REJECTED: The output fails invariant checks, violates diff thresholds, or triggers a circuit breaker20.  
> 7. ABORTED: The session is terminated by the hypervisor due to a timeout, resource violation, or cancellation request7.

### **Formal JSON Schema**

The following schema defines the structure and requirements of the Agent Execution Packet:

&nbsp;

&nbsp;

&nbsp;

JSON

{  
  "$schema": "https://json-schema.org/draft/2020-12/schema",  
  "$id": "https://specs.codingagents.io/v1/agent-execution-packet.json",  
  "title": "AgentExecutionPacket",  
  "description": "Universal contract-first payload for multi-agent software engineering delegation",  
  "type": "object",  
  "required": \[  
    "aep\_version",  
    "packet\_id",  
    "lifecycle\_state",  
    "contract",  
    "environment"  
  \],  
  "properties": {  
    "aep\_version": {  
      "type": "string",  
      "enum": \["1.0.0"\]  
    },  
    "packet\_id": {  
      "type": "string",  
      "format": "uuid"  
    },  
    "correlation\_id": {  
      "type": "string",  
      "format": "uuid"  
    },  
    "lifecycle\_state": {  
      "type": "string",  
      "enum": \[  
        "PROPOSED",  
        "ACCEPTED",  
        "EXECUTING",  
        "EVALUATING",  
        "COMPLETED",  
        "REJECTED",  
        "ABORTED"  
      \]  
    },  
    "contract": {  
      "type": "object",  
      "required": \["goal", "invariants", "acceptance\_criteria"\],  
      "properties": {  
        "goal": {  
          "type": "string",  
          "description": "High-level functional specification of the task"  
        },  
        "invariants": {  
          "type": "array",  
          "items": {  
            "type": "object",  
            "required": \["type", "target", "description"\],  
            "properties": {  
              "type": {  
                "type": "string",  
                "enum": \[  
                  "IMMUTABLE\_FILE",  
                  "MAX\_DIFF\_LINES",  
                  "FORBIDDEN\_AST\_NODE",  
                  "PRESERVE\_TEST\_PASS"  
                \]  
              },  
              "target": {  
                "type": "string",  
                "description": "Filepath pattern, AST pattern, or test identifier"  
              },  
              "description": {  
                "type": "string"  
              }  
            }  
          }  
        },  
        "acceptance\_criteria": {  
          "type": "array",  
          "items": {  
            "type": "object",  
            "required": \["command", "expected\_exit\_code"\],  
            "properties": {  
              "command": {  
                "type": "string"  
              },  
              "expected\_exit\_code": {  
                "type": "integer"  
              },  
              "timeout\_seconds": {  
                "type": "integer",  
                "default": 60  
              }  
            }  
          }  
        }  
      }  
    },  
    "environment": {  
      "type": "object",  
      "required": \["base\_repo\_path", "target\_branch", "worktree\_alias"\],  
      "properties": {  
        "base\_repo\_path": {  
          "type": "string"  
        },  
        "base\_commit\_hash": {  
          "type": "string",  
          "pattern": "^\[0-9a-f\]{40}$"  
        },  
        "target\_branch": {  
          "type": "string"  
        },  
        "worktree\_alias": {  
          "type": "string"  
        },  
        "sandbox\_isolation\_level": {  
          "type": "string",  
          "enum": \["WORKTREE\_ONLY", "BUBBLEWRAP", "DOCKER", "FIRECRACKER"\],  
          "default": "BUBBLEWRAP"  
        }  
      }  
    },  
    "runtime\_policy": {  
      "type": "object",  
      "properties": {  
        "timeout\_ms": {  
          "type": "integer",  
          "default": 300000  
        },  
        "max\_turns": {  
          "type": "integer",  
          "default": 25  
        },  
        "circuit\_breaker\_max\_stagnant\_turns": {  
          "type": "integer",  
          "default": 3  
        },  
        "raw\_args\_passthrough": {  
          "type": "array",  
          "items": {  
            "type": "string"  
          }  
        }  
      }  
    },  
    "execution\_artifact": {  
      "type": "object",  
      "properties": {  
        "assigned\_agent": {  
          "type": "string"  
        },  
        "target\_commit\_hash": {  
          "type": "string",  
          "pattern": "^\[0-9a-f\]{40}$"  
        },  
        "files\_modified": {  
          "type": "array",  
          "items": {  
            "type": "string"  
          }  
        },  
        "git\_unified\_diff": {  
          "type": "string",  
          "description": "Strict git diff patch generated against base\_commit\_hash"  
        },  
        "invariant\_verification\_results": {  
          "type": "array",  
          "items": {  
            "type": "object",  
            "properties": {  
              "target": { "type": "string" },  
              "passed": { "type": "boolean" },  
              "message": { "type": "string" }  
            }  
          }  
        },  
        "token\_telemetry": {  
          "type": "object",  
          "properties": {  
            "prompt\_tokens": { "type": "integer" },  
            "completion\_tokens": { "type": "integer" },  
            "total\_cost\_usd": { "type": "number" }  
          }  
        }  
      }  
    }  
  }  
}

### **Git Diff Integration and Merge Safety**

The git\_unified\_diff property serves as the primary artifact for code modifications, ensuring atomic and verifiable state changes:

Tasks are anchored to a verified commit hash (base\_commit\_hash)21. Upon completion, the hypervisor extracts the unified diff directly using git \-C \<worktree\_path\> diff \<base\_commit\_hash\>..HEAD.

The orchestrator inspects this patch against contract invariants without loading intermediate tool execution logs into its context window14.

Once approved, the patch is applied using git apply \--check followed by a fast-forward merge: git merge \--ff-only \<target\_branch\>. If a task is rejected or aborted, the hypervisor removes the worktree and deletes the branch cleanly: git worktree remove \--force \<worktree\_path\> and git branch \-D \<target\_branch\>.

## **Conclusion**

The shift from brittle CLI wrappers and unmanaged shell commands to an **Agent Hypervisor** architecture addresses core scalability and reliability challenges in multi-agent software engineering. Replacing verbose conversational transcripts with structured state packets and unified diffs prevents the context window degradation and attention loss that undermine long-horizon tasks14.

At the system level, combining declarative contracts with kernel-enforced sandboxing—such as cgroups v2, process groups, and canonicalized git worktrees—protects environments against infinite iteration loops, resource leaks, and filesystem breakout vulnerabilities6.

Adopting standardized communication interfaces like the Agent Execution Packet establishes an efficient, secure, and vendor-agnostic foundation for autonomous software engineering.

#### **Works cited**

> 1. CLI Startup Flags | shanraisshan/claude-code-best-practice, [https://deepwiki.com/shanraisshan/claude-code-best-practice/8.1-cli-startup-flags](https://deepwiki.com/shanraisshan/claude-code-best-practice/8.1-cli-startup-flags)  
> 2. Headless AI Coding Agents in CI: Claude Code, Codex CLI, Gemini, [https://www.developersdigest.tech/blog/headless-ai-coding-agents-ci-comparison-2026](https://www.developersdigest.tech/blog/headless-ai-coding-agents-ci-comparison-2026)  
> 3. Cursor Dangerously Skip Permissions: \--force and YOLO \- Pushary, [https://pushary.com/cursor-dangerously-skip-permissions](https://pushary.com/cursor-dangerously-skip-permissions)  
> 4. Google Antigravity, [https://antigravity.google/](https://antigravity.google/)  
> 5. MCP: Why AI Integration Is Repeating Software History, [https://medium.datadriveninvestor.com/mcp-why-ai-integration-is-repeating-software-history-77a23770e215](https://medium.datadriveninvestor.com/mcp-why-ai-integration-is-repeating-software-history-77a23770e215)  
> 6. CVE-2026-55607: Claude Code Git Worktree Confusion ... \- Penligent, [https://www.penligent.ai/hackinglabs/cve-2026-55607/](https://www.penligent.ai/hackinglabs/cve-2026-55607/)  
> 7. The standard Linux process management API is a total mess IMO. It, [https://news.ycombinator.com/item?id=42485318](https://news.ycombinator.com/item?id=42485318)  
> 8. Comprehensive AI / LLM Security Guide \- chs.us, [https://chs.us/guides/ai/](https://chs.us/guides/ai/)  
> 9. Claude Code Features and Settings Reference 2026, [https://hidekazu-konishi.com/entry/claude\_code\_features\_settings\_reference\_2026.html](https://hidekazu-konishi.com/entry/claude_code_features_settings_reference_2026.html)  
> 10. Chain of Grounded Objectives: Bridging Process and Goal-oriented, [https://www.alphaxiv.org/abs/2501.13978](https://www.alphaxiv.org/abs/2501.13978)  
> 11. Your Coding Agent Sandbox Probably Leaks. Here Is Where., [https://www.digitalapplied.com/blog/agent-sandbox-escapes-worktree-symlink-command-filters-2026](https://www.digitalapplied.com/blog/agent-sandbox-escapes-worktree-symlink-command-filters-2026)  
> 12. Claude Code Headless Mode: The Complete Self-Hosting Guide, [https://amux.io/guides/claude-code-headless/](https://amux.io/guides/claude-code-headless/)  
> 13. The Engineering of Multi-Agent Collaboration Systems \- Medium, [https://chierhu.medium.com/the-engineering-of-multi-agent-collaboration-systems-a-first-principles-technical-report-ca6b3556dcd3](https://chierhu.medium.com/the-engineering-of-multi-agent-collaboration-systems-a-first-principles-technical-report-ca6b3556dcd3)  
> 14. ACP vs MCP: What's the difference for agentic coding? \- CircleCI, [https://circleci.com/blog/acp-vs-mcp-whats-the-difference-for-agentic-coding/](https://circleci.com/blog/acp-vs-mcp-whats-the-difference-for-agentic-coding/)  
> 15. Structured Inter-Agent Communication \- Emergent Mind, [https://www.emergentmind.com/topics/structured-inter-agent-communication](https://www.emergentmind.com/topics/structured-inter-agent-communication)  
> 16. Special Issue: Software Agent Mobility, [https://scpe.org/public/issues/SCPE\_63.pdf](https://scpe.org/public/issues/SCPE_63.pdf)  
> 17. Long-Session Context Degradation: How Multi-Turn Conversations, [https://tianpan.co/blog/2026/04/19/long-session-context-degradation-multi-turn](https://tianpan.co/blog/2026/04/19/long-session-context-degradation-multi-turn)  
> 18. agent isolation, delegation trust, inbox spoofing · Issue \#76 · HKUDS, [https://github.com/HKUDS/ClawTeam/issues/76](https://github.com/HKUDS/ClawTeam/issues/76)  
> 19. Unstable Safety Mechanisms in Long-Context LLM Agents \- arXiv, [https://arxiv.org/html/2512.02445v1](https://arxiv.org/html/2512.02445v1)  
> 20. An Empirical Study on Failures in Automated Issue Solving \- arXiv, [https://arxiv.org/html/2509.13941v1](https://arxiv.org/html/2509.13941v1)  
> 21. SWE-bench Verified Issues Benchmark \- Emergent Mind, [https://www.emergentmind.com/topics/swe-bench-verified-issues](https://www.emergentmind.com/topics/swe-bench-verified-issues)  
> 22. (PDF) μ2Log: Towards remote coordination \- ResearchGate, [https://www.researchgate.net/publication/225788208\_m2Log\_Towards\_remote\_coordination](https://www.researchgate.net/publication/225788208_m2Log_Towards_remote_coordination)  
> 23. Wax: A Wide Area Computation System, [http://reports-archive.adm.cs.cmu.edu/anon/1994/CMU-CS-94-230.pdf](http://reports-archive.adm.cs.cmu.edu/anon/1994/CMU-CS-94-230.pdf)  
> 24. Cursor agent \-p (print/headless mode) hangs indefinitely and never, [https://forum.cursor.com/t/cursor-agent-p-print-headless-mode-hangs-indefinitely-and-never-returns/150246](https://forum.cursor.com/t/cursor-agent-p-print-headless-mode-hangs-indefinitely-and-never-returns/150246)  
> 25. Tuple Spaces – Good Ideas Don't Always Win (2011) | Hacker News, [https://news.ycombinator.com/item?id=17635413](https://news.ycombinator.com/item?id=17635413)  
> 26. digital-archaeology/synthesis/evolution-of-coordination-abstractions, [https://github.com/t81dev/digital-archaeology/blob/main/synthesis/evolution-of-coordination-abstractions.md](https://github.com/t81dev/digital-archaeology/blob/main/synthesis/evolution-of-coordination-abstractions.md)  
> 27. kwike: LLM-First Agentic Workflow Composition \- DevelopMeh, [https://developmeh.com/i-made-a-thing/kwike-llm-first-agentic-workflow-composition/](https://developmeh.com/i-made-a-thing/kwike-llm-first-agentic-workflow-composition/)  
> 28. language-server-protocol \- AI Agent skill \- EliteAI.tools, [https://eliteai.tools/agent-skills/language-server-protocol-2](https://eliteai.tools/agent-skills/language-server-protocol-2)  
> 29. MCP vs A2A: The Complete Guide to AI Agent Protocols in 2026, [https://dev.to/pockit\_tools/mcp-vs-a2a-the-complete-guide-to-ai-agent-protocols-in-2026-30li](https://dev.to/pockit_tools/mcp-vs-a2a-the-complete-guide-to-ai-agent-protocols-in-2026-30li)  
> 30. Feature: A2A (Agent-to-Agent) Protocol Support — Remote ... \- GitHub, [https://github.com/NousResearch/hermes-agent/issues/514](https://github.com/NousResearch/hermes-agent/issues/514)  
> 31. Firecracker vs gVisor: Which Sandbox in 2026? \- Aleksei Aleinikov, [https://www.alekseialeinikov.com/en/blog/topics/devops/microvms-firecracker-vs-gvisor-secure-workloads-2026](https://www.alekseialeinikov.com/en/blog/topics/devops/microvms-firecracker-vs-gvisor-secure-workloads-2026)  
> 32. Kata, gVisor, or Firecracker? Container Isolation Guide \- Edera, [https://edera.dev/stories/kata-vs-firecracker-vs-gvisor-isolation-compared](https://edera.dev/stories/kata-vs-firecracker-vs-gvisor-isolation-compared)  
> 33. Revisiting Using Docker \- Gregory Szorc's Digital Home, [https://gregoryszorc.com/blog/2018/05/16/revisiting-using-docker/](https://gregoryszorc.com/blog/2018/05/16/revisiting-using-docker/)  
> 34. Podman vs Docker 2026: Rootful, Rootless, and Benchmarks, [https://lucaberton.com/blog/podman-vs-docker-2026/](https://lucaberton.com/blog/podman-vs-docker-2026/)  
> 35. PDEATHSIG is almost never what you want \- Recall.ai, [https://www.recall.ai/blog/pdeathsig-is-almost-never-what-you-want?02578d5c\_page=17](https://www.recall.ai/blog/pdeathsig-is-almost-never-what-you-want?02578d5c_page=17)  
> 36. website/security/sandbox-runtime-comparison.md at main \- GitHub, [https://github.com/agentpatterns-ai/website/blob/main/security/sandbox-runtime-comparison.md](https://github.com/agentpatterns-ai/website/blob/main/security/sandbox-runtime-comparison.md)  
> 37. guides/process\_groups.md \- forcola 0.3.0 | Hex, [https://hex.pm/packages/forcola/0.3.0/files/guides/process\_groups.md?fallback=default](https://hex.pm/packages/forcola/0.3.0/files/guides/process_groups.md?fallback=default)  
> 38. \[feat\] Non-interactive / headless mode for containerized deployments, [https://github.com/awslabs/cli-agent-orchestrator/issues/152](https://github.com/awslabs/cli-agent-orchestrator/issues/152)  
> 39. Sandlock: Confining AI Agent Code with Unprivileged Linux Primitives, [https://arxiv.org/html/2605.26298v1](https://arxiv.org/html/2605.26298v1)  
> 40. SWE-Bench ProMax: Benchmarking Agents on Large-Scale, [https://www.alphaxiv.org/abs/2608.09802](https://www.alphaxiv.org/abs/2608.09802)  
> 41. What we can all learn from the Claude Code source \- brtkwr.com, [https://brtkwr.com/posts/2026-04-01-what-we-can-all-learn-from-the-claude-code-source/](https://brtkwr.com/posts/2026-04-01-what-we-can-all-learn-from-the-claude-code-source/)  
> 42. SWE-Bench Pro: Can AI Agents Solve Long-Horizon Software, [https://tldr.takara.ai/p/2509.16941](https://tldr.takara.ai/p/2509.16941)  
> 43. ContextBench: A Benchmark for Context Retrieval in Coding Agents, [https://arxiv.org/html/2602.05892v3](https://arxiv.org/html/2602.05892v3)  
> 44. Securing Git: Addressing 5 new vulnerabilities \- The GitHub Blog, [https://github.blog/open-source/git/securing-git-addressing-5-new-vulnerabilities/](https://github.blog/open-source/git/securing-git-addressing-5-new-vulnerabilities/)  
> 45. Sandboxing LLM coding agents: part1 \- VirtusLab, [https://virtuslab.com/blog/ai/sandboxing-llm-coding-agents-part1](https://virtuslab.com/blog/ai/sandboxing-llm-coding-agents-part1)  
> 46. The Harness is the Product | AWS Builder Center, [https://builder.aws.com/content/3IS39SjCrpN9KHPrGvLVxvWxL5t/the-harness-is-the-product](https://builder.aws.com/content/3IS39SjCrpN9KHPrGvLVxvWxL5t/the-harness-is-the-product)  
> 47. Understanding Sandboxes: gVisor, Hypervisors, and Firecracker, [https://www.salmanq.com/blog/understanding-sandboxes/](https://www.salmanq.com/blog/understanding-sandboxes/)  
> 48. A developer's Claude Code CLI reference (2026 guide) \- eesel AI, [https://www.eesel.ai/blog/claude-code-cli-reference](https://www.eesel.ai/blog/claude-code-cli-reference)  
> 49. The history of sending signals to Unix process groups \- Hacker News, [https://news.ycombinator.com/item?id=32733844](https://news.ycombinator.com/item?id=32733844)  
> 50. GNU/Linux Programmer's Manual \- mirrors.kernel.org, [https://mirrors.edge.kernel.org/pub/linux/docs/man-pages/book/man-pages-6.15.pdf](https://mirrors.edge.kernel.org/pub/linux/docs/man-pages/book/man-pages-6.15.pdf)  
> 51. Gemini CLI configuration, [https://geminicli.com/docs/reference/configuration/](https://geminicli.com/docs/reference/configuration/)  
> 52. Cursor CLI: Headless, Terminal-Native Coding (2026), [https://www.learncursor.dev/guides/cursor-cli](https://www.learncursor.dev/guides/cursor-cli)

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABMAAAAaCAYAAABVX2cEAAABG0lEQVR4Xu2TvUoDQRRGr6YylYRgYylEJKl8gBSJDyAGS1sV6zTpAmmsBCFNqjSBGF9C0MKAIqJgI4jYmE4bsRB/zjiz7M5lNo2VsAcOO3O/Yf7YEcn4KzV8wGec4MCPf7nAR7wXO/bASwMc4St+4ZLKctjGU1z0ozA32MRvCa+8j5u6GGIZj3Ee3/AF894IkTNcULUgO7jn2j2xu9uOY5nDq0R/KkNcce2K2MnMsSPq2E30p3Kt+idiJ6y6fgcbcZxOdF9JNsROFtXNfRXjOJ1die8rwvwKT/iBJbz043RGWNZFaInd3TkeqizIDN65r8Yc613shOsqC7KFtzirA0cfP7GggyRrYt+hWdlonpF5o5pVHOtiRsa/5gcPXDQmGhr6FgAAAABJRU5ErkJggg==>

[image2]: <data:image/png;base64,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>

[image3]: <data:image/png;base64,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>

[image4]: <data:image/png;base64,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>

[image5]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAAAxCAYAAABnGvUlAAAEtElEQVR4Xu3caahtUxwA8GUWIclcemROhpDpy0WSDCUpmYcoX8gXSuhESoZkHqL3Ssb4wAciec8XGSJSMuZmzPTBnBLW397bWW+dc+85xzvX6z6/X/3be/332cNZ59ZereGmBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwP/QDnWCRWXHHGvXSQBgzXFRjjfrJIvKXTley7FLfQAAmJ79cvyZY50i906OP4ryQrg2NfdlzRC/5aF1EgCYjofSYMMpyrdWuWm7MQ3el8Urfssj6iQAMB2f5fihysXL98QqN203p8EGWwyr7VWUNyn2J7FvjiPr5JgOSs28rOhxPKY6trocXJU3q8rjiDrZoE6OIeoijKqL+C3/bZ0DACPEi/btHM+28VKOt1b6xNxeHBLLc7yQ45nic8OsyPFKUe4WH3zZbi9Mgw26cZTPHuePamiUNm233+RYkuOGHDPdwdXk5By75zi3LT+a48P+4ZHiO93d7l+eJqvTJ1NTF5+n0XURjf4r6yQAMB3xAj+wKB+f45aiHMr5basqVhRGj1HMk9u/yJ+Z+vPpwmM5Pu4f/rvRMo7fiv3fU78RtnWOC4pjw0Q9LEn9Z4hytwJy3PtPW8z1uyQ1zxW+yrH0n6OjV2jen2OLdv+a1NRJZ61if5hTUlMXl6aV6yLOq889LscvOXaq8gDAKtotDfaEvZ76L/hOvLiHOWqeGDU89lOOK6rcu6np5QvRUDi/ONYr9udybGoaJSGG/24qjs2kpqdolPtyfFcn03j3Xyhlr1jsdysyY/g26mw+5bm/pn6drJvjx+LYXKIu6kZhnLdtlXs5NX87AMCUxZDXIVWufMFHz9pMjg2L3LTEHLZ6Jeq3Oa5Pzdy1aFzE/Tduj/XabalucKyf44wcm+d4I8fOOW5vj82kwQZb3P+0Khff/+IqF3pVOXr/6vufnQaHHOM7RK/YVlU+hievrnKhvmborrlHjudybNSWn89xersf4pl2Lcrh53YbdRLXiTrZO8dVOe7tPpSaZ7+nKIft0mBdrJea8+q/ibj2qEY6ADChx1PTKPo6NY2As3J8lJphrdkce7afu6zdTtuwVaLReJpNzf/1+j418+k6vWK/M6xxM5tjWWpWLMZcutva/EyOL9r9TvQePVDlouev68Eq9aryw2nw/vFvLT6tcuGp1DQmSyfkOKnKhfqaIVbsPpLj6dQM+cb3CjFvbJvuQ6l5pvOKcohh4GiILcvxSeqfGz2rZc9pPPsHRTkcnYbXxbAe1/gtD6+TAMDCi3lK0ShYiBWj16XBBtt8enUiDfYIzWcm9Rc0dE7NcU6Vm0uvTqTJ7j+uSa4ZPV31ys9uVeco77fbrrcuLC3253JAu62Hs+O3PKzKAQD/kVfTwqz+m2TFYjfEGY2ZmHfXebDYHyV6p6LXLibHd1ak/pDrfO5M/ft3YhL+JPcf1yTXXJ6aRQWdcvHIKO+lZvi5tE9VHmb71JwXPYSl+C3HOR8AWGS2TP05ZixOT+S4Iw2uGgUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABo/AVHxcKOemj/JAAAAABJRU5ErkJggg==>

[image6]: <data:image/png;base64,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>

[image7]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA0AAAAaCAYAAABsONZfAAABIklEQVR4Xu3SvUuCURTH8dOLRjmI0dRQWBQ09B80ZSDOBk2tEbm29hfU2svS4BK0CC1RhGNDCDpESzREY5RbREgv38Pt0fMcxKFN6Aefwd+5j977XEX6NgOYQQ55pOPjeFLYxj2+jTfMmnXtzOEWRyhI+IJp1PEl4ZdjmcIrdl2v29SHKq6XYVzjEoNutokbTLheViXsu+gHJOOLKBf4xLgfmCTsB93OBxq2NBnFOfZtqS9At/ZgSxM9k87XbKl7ju7C30MWTbTEbf1PD2keJTy0Zzo9i55T+yvTtxO9clXDKe5w9tttdJbGs4JjCTe/jhEc4hljZl3PTOIdW34QZQkn2MEy5lHFgV3kU8aLdM71hBKG7KJu0X/zAhaRdLP/dMsPK/w75bRReoUAAAAASUVORK5CYII=>

[image8]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA0AAAAYCAYAAAAh8HdUAAAAzElEQVR4Xu3RPwuBURTH8SMsRsqAKLvFO7CTZBKZJJPFW7DYlcVkNhuUdyBsBqt/g8GiKP++j/tc6ZYnK/nVp1vn3NO9tyvy2wmjgR5mWGKFDba2Cbx6oIYF2qijihZu9lpBCX49kMQeKV2wM8IULqP+SAQBo5YQdYp16sdpihqKmQ2njEW98eMEcUXHbDilKOpqebPxLtYf7NA1G04p4IDQS82DMqIvNYkjjRzWGCCDrKgr9jGEWw9YOYl6g3bBGUfMRf2V77n7n6/JHZ5RKJqJHyogAAAAAElFTkSuQmCC>

[image9]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAZCAYAAABzVH1EAAACk0lEQVR4Xu2WWYiOURzGH/saJWuWLBeyr1EKEyXLDUUu1IQLawlZrogUZSsiayl7JLmhyBUucINckO3ChS3KmlA8j+e8M+c9M9+UacY3F9+vfs17zv980/m/55z/eYESJYpCr+C/0D3tKDY96De6Ow3UQH/6NO0sNsvpb3o7DRSgI5zEjTRQbM7DifykrZNYSgs4AY3fl8SKSiP6jj6EJzcpH67CKThhjdVKNhiG0Cd0JTy5jflwjs30Bd0Pj52SDxeXFXQnHQZP7mo+XMF8+oEOoEfgsX3iAcXmIh0Pb7H39DNtkhsBTKdfaVloK9nvtHE2IKFN2lHfaMKPw19xFn7TYytG+PkLnRf1PaLPonbGYHi1VP0W0a20GZ1I79EDlUPrlmn0WNQuhxPZHtqD4EKwtmKE0Z1zN+kTqmZj6Cw6B06obYhpCx8Pz3WOym5Z1O4Ab6GXdCh9RXdFcdEJhc+SxutyrY6lqKdE9DlyP+0ke+GJ/qCH4LMTMxyO62zFrINfwmE6g26Ct2rXEF+CfCKj6Q44wS6hbwK8clvottBXLdqv+gwZQS/QBfnwX3rD98RBVE1CjIITuQafrWzr6KJ8QwfSprQnfLb6hnicyFR6BZ5PGTwX/a+bIS7UV5DZ8CSkLsC0OmVonxeiG/z7X3ChGBnFXqNy4uJt1I4TOU0v0VV0Df1EW9LL8DnT6marVC2q+9fpA/ijr7ZoJRfT9km/EumXtONEToRnvUQloRXJFJ3paniOWrFC5b3e0daKE1E7S2QZPRmeN8CfOhkz4SSORn23aLuo/d/YQz/Sc3Rc1D5DJ9M79DldCK+A7ht96qync+GKqftJBUBJ1/Sp1ODQ5JuHZxWWVnCh0HkpUaJELfkDs+KDnaeHj1EAAAAASUVORK5CYII=>

[image10]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACMAAAAZCAYAAAC7OJeSAAAB1UlEQVR4Xu2VSyhEYRTHjzeRhTzKa6GUnQWRlIUsZCPChvJaeKTIqyhJNlJSSpSyEBEbWXhnIxtWFvLIwoLCzopY8D/OZb45zJiamavkV7+63znfd++Zb879LtE/f4BqmKuDv0EafIEnMFDlbGcGPsJXWKlytpIKT2EDSTHHMMBpho1MwkYYBC9JCip1mmETifAMhlhjLoqLOfqcYSPjsMkYc1FXJAUVG3G/Ew/PYaiKt5AUc6DifmUEtukgCIPXJAUVqpw7amGRDnpCDLyA4Tph0U5SzJ5OuGECdhjjQRhrjF0yBDt10CAC3pEUlK9ynsJvZpwOaqJJdiVSJxS9JMVsqHgNHIU9sB4uwiw4S7KjfIIvkaydJrmPS/rhLdyFO3AbbsFN5T7JDdns95VEZXCd5FCcIum7TJK3cAzOWfP47+d1KSQ9+C2cuCfHQzx1hReT9MS8dV0H16xrppUcxTC87se/yRuSST4d3SS7mmfkmulrMQkwg+R09zklsIrkjNIP4PPJLOYJJsEBGGzEfQbf/Bk+wBu4CtNhATwk+bRwXzHcQwuwzxr7nGWYQ7Ir3H/8LTP7RhOlA76ED7aPX85wMcPG2Fb4la6AXSRNXO6c/sd73gBDtGDLPcT7HAAAAABJRU5ErkJggg==>

[image11]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACUAAAAZCAYAAAC2JufVAAAB8UlEQVR4Xu2WzytmURjHH4wixq/Y2EwIiazsRhbKDqkpCxq/BhvlV2SmSYnys5AUFlYiRplJ+QdmM8pGEwsRNuyUKCXE99tzbvc6i3eB90d6P/Xpvfc853177nmec+4rEuYdkwUrYIEdCDSRsBfuwkeP3d5JgSQW/oELMBPGwUHRpJhoUNiA+6Kr5VADl2CCZyxgpMF7uGUHgkmOaJluYa1oKUOCWXEb+wYOPQ8Hh2p4ATdhq4TAak3AbZhhB/xAGzyGX+2AlwZ4DT9Z4/6EO73JHnT4CC/hoh0wMJ5kD74Ba+IjqXLRxl62A6AMnsJcc58Ox2GnuK+eMTgs7uE6aubkwzw4APtFvxNh5pBV8ZFUlWhSD7AeJsMY0Xr/h9lmXopoH6TCRHgIo8z4Oaw08/gGaIcf4AycNONzsM9cE59J8csr8E40OR6gZ6KnOBN04G7cg13GI1hsYiNw3lxPmU/CleEDlIomwT5y8JmUA/vmCyyS568ZB55hfC9Ge3TKwdVkX7LMHWaMcMX+iSbP8v32xJjUN8/9iyiBJ6LJkEJxe438hTui5SUs7ZXoQ5Kfog/VY+5/wWZz/Sr45Nw1/OHvVqwOrltj06Kr0yja7AfwB2wR3UA8Fz87k18DT3n2iQ1Lzr86NvHiri77N0yYgPMEGwlXsWbpCxAAAAAASUVORK5CYII=>

[image12]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFEAAAAaCAYAAADPELCZAAAD50lEQVR4Xu2YaahNURTH/+ZMmSJjETJlypRkKnwwlDEUkSFzPpgKyRBS5uIDHwwlGYooRJGEMmT8YuyZMiaZM6//W+f09lnn3HfO475bV/dX/153rb3POXvvtdde+wE5cvzP1LWGLKOsqKY1/g3VRC2c3x1E/US1HFsUi0XzrTHLKC+6iOD4i8wI0X1RR9Eo0R3Rb08/RLMLmgYYAm3LlfTpKrqcQBdEZ0RttVtaOCx6KnohegYNBJfRoieiB9Dx3hU18XyDRA8RHzQhSovWQ1/IVVgquimqB33YEuhE/vL8LnVEH6Avd9kuuiYaIGogqi06CX3OYOi2oX2cZ/MHkS6ai95Bn73L+AjH9QYaLO7ik+OiPcYWy1pRnqixaCA06hiNLuehH7Tc2JeJThgbF4WRWd3Yn0MnnH4XRk0pY/tXpormiF6LviKc6ypCAyWKZtA+rawjFYyK79COfPAj0YZAC2UFdBJ3OzauILfMcMdG+orWGBsjg/25yi4lRVeMLR3sFbUUrYK+d2HQjT6iLcbmclq0yRqjKAGNgp3e77HQB3MyLTxc+DHui7t5tnaOjYyHRrULI4NtFxh7ZdEiY0sH172/TBncWY8RjHYGhV18l22i29YYRRfowPpbRwTDoG1nOrYxnq2SY0vFPmjbztZRDHBX8X0+B6HvHurYziK8xV1YabCPTUkhuOXYkGVNHNwObNvTsfHA4XZOwkvRe6Q/90UxRTTN+c1v5rdzi5IKoqsF7kg44ewTmxcZrjxxkwyMJytLAeYwnx2ic87vVPBD+EHHrCMBraGl0EjrKAQ/H7rwEPEnhflwc9Adog3CQRPJPWhDJv3C8FdyorEf8RTHDGj/edaRAEYV+7oHWhw3rEGYDH3OVtFKBLd2FMylbM8JLxTWQmzI4jMVPHxYxTOvWFh/JUm+fk7qZB0JKAMtu2Jzkwfr2APWCN3Cb0UfoZNcI+gO0QP6zU2twzId2pBVexXjIzylD0EnkaeoZZ3oM3SiU0Efa7VM5UNG/Sxr9GA9zPH6J3dhTBD9RLgQD8HbBieQD2Zu47WPk1UVemLzxsFtVM7vYJgE7VvfOhx4GrPNKesoBhitrDk5jigaQSdmo3VEwPqSZVEieB27BR0o9Q36IpYAvZ12UTSE9ukVNOf/N4f30jxoBH7xxPsqF42DSTdHRZ+gO4PvskW9D3dWkpJuP4p4EPIa1h5abHdH9NZOBXPiXGvMcliB8NDlP1YyAi/wzHlMAf8LPMl5/c1EDs+Hq3YJ0fftbITB8Aqp82qxwQOKOTCu3swGeOistsZMwfqM5UU2w7OAV2H3VpYjR44cORLwByvz0XJeAT0oAAAAAElFTkSuQmCC>

[image13]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADQAAAAaCAYAAAD43n+tAAADH0lEQVR4Xu2XWchNURiGX0OGzCkZS2R2QeZkuqEMRYYobkzJkAvDBZKppAy5IBdkShQRV0gkpEgylvFHlHKhzJnf17eOf53v32ef459unKfeTvv91l57rfWt6QBF/k9ae6OCtPFGeWhGdYue+1AjqRaRl8Qqark3K8hsaoc3/4XJ1GOqLzWVekD9CvpOLS4tmsUEWNk6PkCGUI+oZ1RJ+FXZUaVFsDb4+vYTalfwa1DXqWXhuWBqU1upV7DsrKFuw1KuzKyGdepniMe0ot5T45zvOQmrQ9n29IDVsZ8aAetIhoHUN6pr5OVlM2yEOlJjYdlQlmKuwBq0zvka3dPOS+I19Qlls6gOnKE6OD/mAHXEm7kYDxuBLlQD6jm1LauEsR7WIVWeQY1TQydFXhKdYe+ec/4SajdV3/meodQPqrkPeJTal9S+8DwDtgjVMY+mihoVL9LBwesVeUnMgZVbEZ4bUgepeX9LpKPdU+/nGzgMgBUc7QMJTISVXRh504OnBqZxCFZuEGwm3KOuZZVIRwP/kdruA55NsA9pq86HRldlh0WeNgtNuXxoFmjRT6FOUA9hdelIKBRtUke96bkL27lq+UACZ2ENqRl5e6lL0XMSnWCN/0JthH1rUfD2ROXycZy64E2PzgdVnG9LVFZUbpbzTwWlMRf2rnbDDI1hGdOuV8jsEOr8ZW96MnN7mg9EaP5epY75AOzcUJbTOAz7hj8GdgZ/qfNzcR7W3lTmwyrVCd3ExYR2O815daiRi4ktsFGOD0KP1tg7lJ3WPWHfLkH2NM7FC2qDNz065dUZVay1oKuPGt4UtvPdhJ07dTMvOHTX0rttfSDQGxbPdfDeh8V1zUqjHmytz/SBJFpSd2AVS19hh9hF2CmeRnvYO8Oz7T/PWp9vqc+wLVcjPCbENUBPqQ+w7CnLGlifxQzdYd/p7wO50F1Oo6mDVZfJpOmXC62hQtdBeVG7bnmzqtB0eQObplWBsqkbuKZ3taAFrVM/6f5XGaykbsDWUbWhzUWjmO88+1f090VrrZ0PVAf6n7TAmxVEl9p+3ixSpEjl8xtDT6k8ODwY8QAAAABJRU5ErkJggg==>

[image14]: <data:image/png;base64,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>

[image15]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAaCAYAAACzdqxAAAABVElEQVR4Xu2UvytGURjHv/kZRjLIIpGZf0DYmCSTSX5sdomBZDAJC0kGGUwmK4sogzCLUFiVFOH7eM7pnOe+99a1mO6nPnXP8z3nvOc+994XKPhvuugNfXKe2LiEfoS5D3TXxqXs0Dv6QSsSmaeOHtJvekDLbJzOBV2GLmpJZJ4lOgOdM5nIUmmkx3QUuqjXxr900lm6Cp3TbuN0hug87YEuGrMxyqG9rKZX9NHG2cgpZFNpgWy8aGNM0W7aQL+Q44F5zmkN9KF90r0oa6Yr7lruTH54PMTZyCmkvx55M06j8Satd9dr0I3bQpyNnGIhGh/RZ3c9SEdChGv8ob/rtC8ab0NP1QR9tz3y5kg9d38vaW00noNuIB9Ca1QfdvWJqJbJAL2nVVFNbl02mI5qwpardyTqBvl/kF690Xf6Cu21z85opRtv0FuEuS9032UFBQV5+QHpY0dlyIXWnAAAAABJRU5ErkJggg==>

[image16]: <data:image/png;base64,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>

[image17]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEIAAAAaCAYAAAADiYpyAAACv0lEQVR4Xu2XSaiOURjH/6ZkKslFkTKHu6EMCyHDxkIybJSkTN2SBYlQNyyszGUqIvPK1so1RRkyxEbGMq1IGcr4/3vO23fO8bnfeb+6VudXv+77nuf0fuc87znPeS+QyWQy6UyjT+kb+paeCMN/uEmf08ewvjuCaNvTkd5HZYyvaP+gR4hiGqf6vqb3aLegRyucoR/oTzokinWgzfQyWh9AW7OEvqC/6NQwFHAIloR3tEsUq4kyvhb2I9Xe+Ha6IG78z+yn22BjVFKqMZuug73Q01GsJiPoOdqTfqLvadegB3CF9ona/sWguCGiB+0VNyZwh46GJWJrFBPd6XE6H9ZneRiuzQra5K4P4u+HaHlpEKmsontouzhAetMW2ITK0EAv0U70O6rXMq1avdS9sDkMC8O10RIa6a4bYQ/RVimYTvd59ylspAcQJkNJUJ0Z77WlMo9ucdeqE9e8mBhLN7nrB7CCWpq70f1FWDImu3stQw2kLJthK0zJUBK0vSYEPdLRW9YJJ7QydIIUqJhrhXSGrRzVh5NePImiPvjMhSWiaNcENJF6UDKO0qt0YhQrw21UToBjsMkW96vpFHdd1Idl7j6ZlajUhwJl+CX9RofTW2G4FP1gS/k8qteMFPSWtaUKmmGT1XYeSHd5MW3huurDWVQvXBtgD7xOd0exVJSEG7DtoKP5MOpLho5tHZsFi2Fjm0WPIDyBHqKO+qBBPXJ/Y7QVvsB+cE4US8FPQsEaVGpGGfT9MNO7V+3SuFroQq+9r2s/5bUlsQhWYdvHAYf29g+UP/P1vaGqPi4OwJKhiaUmYyjsK3GU1zYANuELXpvQfNSu7Z7EDNjD9calPq2LiuyjI0lvtSzr6Zi40UM1aVLcGKHvBS3zz7AxfqU7XUxJfEYHu/ul9An9iMp89H9R6c/rTCaTyWQymUwJfgOyAo2IAE4wKgAAAABJRU5ErkJggg==>

[image18]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAAWCAYAAADNX8xBAAAAsElEQVR4Xu3Quw4BQRiG4XEo3IDEMVFQbKdXuwHXIEoFeoWodSqFbivUCiGhUWlcD94RkvFlnPp5k6fY7082mzUmFHopgZ6O0kAHXy2MdJTmqOnolsIJOT1Idax1fJbEGF09vGmCjo4V7DFF4UdFrLB4PN+zb79ih/gPR1wwNE72J9uvyrrjh6rYoKEHW4SDjp4yOKOkB7cZmjpKbfR11MpY6ihtkdbRV14H6ds95OkGw10dsXCIuDMAAAAASUVORK5CYII=>

[image19]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADQAAAAWCAYAAACPHL/WAAAAqklEQVR4Xu3VoQoCQRSF4SuKmgTBIpgEm6DVJNgFs8VmsWuzGC0bDTZtVrtJ0AfxPfyXSXfe4Cz3h6/sSRN2xiyKoijy9fIPqk1wwwOtbJNqjifuGGebTDUs8cIFQz/rVMcab5zR97NOTWzxwRFdP+s1ww97tLNNtvIgO3xxQMfPujWwsfQfnaxC7055060s3XQFBn7WbmHpLbpilG3STS29S5W5OKIo8v0BsfcSC1EyjUwAAAAASUVORK5CYII=>

[image20]: <data:image/png;base64,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>

[image21]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHoAAAAZCAYAAAD+OToQAAAFXElEQVR4Xu2ZV6gkRRSGf3OOqKiIa86oiGD2GnZfDGDAnDCLigkMGEdFBH1QfDHjmjOoqKyi3jYHTJhFYVVWMYAJRUVFz+eZ2ltdUz3TMzvMepf+4H+4VT0zXfVXnTqnrtTQ0DBvsnjaMMlYzDRf2tjQyQxN7ok61zSWNjZ08pTyRm9gOtl0n+lN017l7tnsbhpX/jtGwfmmndPGETK/aU/TZabTTauUu2vBQs0t1immU03bmZY0rWna33RY/FBdckYfb3rHdKXpBtM/ppdLTziEzR9Md6cdI2RuGr2w6QHTY6YdTWeZvjRtEz9UwTTT9aaZ8vk9s9z9H4yLvlh8/9bxQ3V5WmWjLze9Z1q6/Terih9gQCkHyvv2TTtGyAUavtErpA0VnGD6RuU8h539iWnBqC0Hc8buPETVRu9kmmV6zfSI6TzTyvED/RAbTYgoTOvN7pW2kr8IOyflIdOvmrsJ3TCN3sx0u+l+0yJJXw6ONAyImSqfr+2T9irY/VVGEyWmp42D8ow6Q3fM0fIXYQAxS5h+Mz2YtI+aCzXnRo+ZHjXdYdok6atiWfm83Jq0b9FuZwHWoZvRO2iERnNG/62JUB7YT/6CByfto2ZQoxkzSdS46TrTWuXunqwrHz/nbMzG7fZrk/YquhlNVHjYdI088r4hN38gGGjO6NVNJ5o+N/1oOsd0tjzhQC+a/lTnAhgWRIw6XKT+jF5Avjh5f5LNQbJkCAalhm7Ybr83aa+im9H0fW/asv33+qZv5Wd13+SMJptkIjCZl/ja9KHpA3mixtlE+1vhAxXcKP/s2mlHBINhQQUw+Gb5kcBK7kVdoxnTcaZX5FFguXJ335D5MgdEg5hg9F1JexXBaDZPClXNlKTtFtNfpnWS9p4U6jQ6QJnFS5AUxPAjtBPWe/GdPMxVwe66J/r7UvmgN5UfD7uquoaHluoZzYRSmvDdiyZ9gxDmgMUcwxlPe51FCsFoomUdyOp5/qi0oxeFqo2mxv5KfikQQ2nAjx2TtOfg892MTqEmPzT6m92N4VW0VM9owOCTTK/KJ3ZOjh0uMNhZaYjeVv0Z183oF0yvqzz/l8if5zKrLwrljV5RPpDcygw/RjmSQrihFCPrZDcSujGaZOcm+WepP6nXl5EnMyH87WP62PS4/EboDHlmz4XEVcqf2y3VNzpAjXuE/HgigtStm1MKdV4khbsFIlKAuawKtcFocqAYPCECfaRyTc5c8TylcF8UyhuNGXxhrh6kfqaPc4/k5kh5WQGUKGGnU4//ITeaVXmQfPFMk2eRy5v2Nn3Rfp4BUcPy23w3elZ+qVAVblvq3+gA4+ZYGDddbVqt3N2TA+T3CKtGbbfJ5zRmpjxxXSNphzH5XBKSU64w7Rb9TUnHXD0RtdWmUN5oyi5ueHJ978tfjh2KsU+alpK/CAOPVyAZewjdLJpZKn/nRpowGjiv4/MHE4YVuruxi7yWZkz9HDVEBBJVIhBz8ZI6jwQSM5JYwn3gYvn8ksP8ZPpZnvzyDgFuwdgQ0+VJ57vyaLdS9ExtCnWayU7i5fjHRo7DTZ/Kdx8DDMZONf0eHmqTGv121Af8Rmo0lzQBjGbnsPtzpVBLwzE6sLk8PFZFkBwYwnUmYXihpG8YMH8krbzbwBTqNHpQMJwzNlw+cI34iyauVHNGU47ERpPcxEbPkIduMn8WUkpLwzV6nqXQ8IwGErA75aXZafJkivBD3cnZwj8B2DEkbewEbn74DxhZ57Gmz0zPyZMlIGw/Lz+vcnfqLTVG16LQcI0OcGYDiUrOoH7g83GJEdNSY3QtTkkbJhl7qP976oaGhoaGhv8r/wIfzBbIstGEgQAAAABJRU5ErkJggg==>

[image22]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFIAAAAWCAYAAABT5cvhAAAAjElEQVR4Xu3QsQnCUBRG4TiECAqWCg6g2LqGVbC3F6ysJAM4go29hTu4gEVAMHt4JCneuyPE88Fp/vuqVxSSJEmS1CdzulNDFxrl50wZB7UW9KQtrelMb1qmjzoTOsVRrSNNw/b7xBftkm1AN5olmxJVHDpDelBNV/rQIXuhzDgOwYb2tIoHSZIk/aUvNOQOsiAO+vUAAAAASUVORK5CYII=>

[image23]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACsAAAAWCAYAAABZuWWzAAAAqklEQVR4Xu3UIQvCcBCG8RNFTYJgEUyCTdC6JNgFs8VmsWuzGC2LBps267pJ0A/i9/AZ/3QXLd7gHviVvWVhO5EoiqJf69kHHpvgijtaZnPTDAVuGJvNRTUs8MAZQz37qI4Vnjihr2cfNbHBCwd09eyrDB/s0Daby8qX3OKNPTp69lkDa0nf7VEqclfLi7CUdBFyDPTst7mkW3vByGxum0q6u5X4CaPo330BsjUSC3+ya14AAAAASUVORK5CYII=>

[image24]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAG4AAAAWCAYAAAAhKqlXAAAAkUlEQVR4Xu3RIQoCQRhH8fUQsqBgdMEDKFavYVrsdsFkEg/gESx2g3fwAgZB0Hv4hA0zX7E55f3glf83bapKkiRJkiRJvzV0oTcdqc7PmTYOKmNCN1rSnPb0pGn6qDOkXRxVxpZGYft+2p1WydajM42TTQUd4tDp05UedKIXbbIXKmoQh2BBa5rFgyRJkiTprz7rgw6ytY8OLAAAAABJRU5ErkJggg==>

[image25]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAWCAYAAAChWZ5EAAABpklEQVR4Xu2UyytFURTGl+dUTLzyHCgJRZQZUooyMzBSBhiQR/4DJSaYmugmlMhAeSYDr6SMTIQBJWVKEgN8q332sc/aZ+Pe8fnVb3C/fe7dX/usfYkiImyKYbcMDUrhAJyA7WItYcrhJLyAn3AzuOzTBO/hEGyGB3Al8ESC1MMeWAvfKbxACnyAY0aWBV/o9xOLG1eBDvgFa0R+DPdFlg7zRSYpkoHGVWCWVIESkW+Q+k6qkWXCI1hhZCa9cE6GGleBJVIFckW+6uXZIi+AZ7BK5H1wASaL3MdVYJfCN+Ih5JwHWVIIz2G197kfLpKaJydcYEuGYIfURjki1wXKRK7RJfjaLtMfmzNcYFuGpJrzRnK41rycb4SLcVK3pU4uhOEqMEXhR70HX2GSyDUjpMrzTJzSz+twwgX4uCWNpAq0ivwKrotMM0zBd54HT8geTJ80+AEPKXitGP6RS1LXUcPv/Q22GJlmEMbInna+RfzfUWmGbfAGPsJnzyd4DTOM53ig7uA8HIW3sMtY1/BNmSF7cw0P8rQM/wufTAPsJPs/ISIibr4B4cFWLMNwshkAAAAASUVORK5CYII=>

[image26]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEQAAAAWCAYAAAB5VTpOAAAAjElEQVR4Xu3QIQoCQRhH8fUQsqBgdMEDKFavYVrsdsFkEg/gESx2g3fwAgZB0Hv4hA0zXzTJ8H7wyv+bNFUlSZIk/buGLvSmI9X5OdPGoTQTutGS5rSnJ03TR50h7eJYmi2Nwvb9jDutkq1HZxonW5EOcej06UoPOtGLNtmLQg3iECxoTbN4kCRJ+tEHWY0OsvjonSYAAAAASUVORK5CYII=>

[image27]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADsAAAAWCAYAAAB+F+RbAAAAjUlEQVR4Xu3PMQrCQBRF0biIEFBIacAFJNi6jVTB3l6wspIswCWksbdwD27AIiCYfeQKU8x8sLH78A7c5v1pJstERERE5H8V3WmiKxXpOdHZwZMNPamlLV3oTXX8KFjR2Y6enKg02/ejL9pH24JutI42d3o7BDk9aKSBPnRMXji0tIOxowM19iAiIiI/zTpGDrK+PfZKAAAAAElFTkSuQmCC>

[image28]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEkAAAAWCAYAAACMq7H+AAAAjUlEQVR4Xu3QsQkCQRQG4bMIOVAw9MACFFPbMDrMzQUjI7EASzAxN7AHGzAQBO3DES7YfQUYuPPBJP/baKtKkiRJ0m80dKE3HanOz5k2DiWY0I2WNKc9PWmaPuoMaRfHEmxpFLbvB91plWw9OtM42YpxiEOnT1d60IletMleFGQQh2BBa5rFgyRJ0p/6ABWdDrIrMsj9AAAAAElFTkSuQmCC>