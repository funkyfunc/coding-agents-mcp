import * as crypto from 'node:crypto';

/**
 * Compute the standard Levenshtein distance between two strings.
 */
export function computeLevenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const row = new Int32Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) {
    row[j] = j;
  }

  for (let i = 1; i <= a.length; i++) {
    let prev = i;
    const aChar = a.charCodeAt(i - 1);
    for (let j = 1; j <= b.length; j++) {
      let val: number;
      if (aChar === b.charCodeAt(j - 1)) {
        val = row[j - 1];
      } else {
        val = Math.min(row[j - 1] + 1, prev + 1, row[j] + 1);
      }
      row[j - 1] = prev;
      prev = val;
    }
    row[b.length] = prev;
  }

  return row[b.length];
}

/**
 * Compute normalized diff drift between successive iterations:
 * Δ_edit(turn_k, turn_k-1) = Levenshtein(diff_k, diff_k-1) / max(|diff_k|, |diff_k-1|)
 * Returns a value in [0, 1].
 */
export function computeNormalizedDiffDrift(currentDiff: string, previousDiff: string): number {
  const cur = currentDiff.replace(/\r\n/g, '\n').trim();
  const prev = previousDiff.replace(/\r\n/g, '\n').trim();

  if (cur === prev) return 0;
  const maxLen = Math.max(cur.length, prev.length);
  if (maxLen === 0) return 0;

  // Capped to avoid extreme matrix overhead for massive patches
  const cappedA = cur.length > 5000 ? cur.slice(0, 5000) : cur;
  const cappedB = prev.length > 5000 ? prev.slice(0, 5000) : prev;
  const dist = computeLevenshteinDistance(cappedA, cappedB);
  return dist / Math.max(cappedA.length, cappedB.length);
}

/**
 * Hash a patch string with SHA-256 for AST oscillation detection.
 * Automatically normalizes CRLF to LF to guarantee cross-OS parity.
 */
export function hashDiff(patch: string): string {
  const normalized = patch.replace(/\r\n/g, '\n').trim();
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

export interface CircuitBreakerStatus {
  tripped: boolean;
  reason?: string;
  stagnantTurns: number;
  drift: number;
  turnCount: number;
}

/**
 * DiffCircuitBreaker monitors iteration drift across multi-turn sessions
 * or pipeline steps to protect against cognitive deadlocks and AST oscillation.
 */
export class DiffCircuitBreaker {
  private previousDiff: string | null = null;
  private seenDiffHashes = new Set<string>();
  private stagnantTurnCount = 0;
  private turnCount = 0;

  constructor(
    private readonly maxStagnantTurns: number = 3,
    private readonly driftThreshold: number = 0.05
  ) {}

  /**
   * Record a new diff iteration and evaluate circuit breaker health.
   */
  evaluate(diffPatch: string): CircuitBreakerStatus {
    this.turnCount++;
    const patch = diffPatch.replace(/\r\n/g, '\n').trim();
    const currentHash = hashDiff(patch);

    // Check for AST oscillation: patch matches a prior iteration state that is not the immediate predecessor (A -> B -> A)
    if (
      this.turnCount > 2 &&
      this.previousDiff !== null &&
      patch !== this.previousDiff &&
      this.seenDiffHashes.has(currentHash)
    ) {
      return {
        tripped: true,
        reason: `AST Oscillation Detected: Agent patch matches a prior iteration state (SHA-256: ${currentHash.slice(0, 8)}).`,
        stagnantTurns: this.stagnantTurnCount,
        drift: 0,
        turnCount: this.turnCount,
      };
    }

    this.seenDiffHashes.add(currentHash);

    if (this.previousDiff === null) {
      this.previousDiff = patch;
      return {
        tripped: false,
        stagnantTurns: 0,
        drift: 1.0,
        turnCount: this.turnCount,
      };
    }

    const drift = computeNormalizedDiffDrift(patch, this.previousDiff);
    this.previousDiff = patch;

    if (drift < this.driftThreshold) {
      this.stagnantTurnCount++;
    } else {
      this.stagnantTurnCount = 0;
    }

    if (this.stagnantTurnCount >= this.maxStagnantTurns) {
      return {
        tripped: true,
        reason: `Non-Progressive Iteration Deadlock: Diff drift < ${this.driftThreshold * 100}% for ${this.stagnantTurnCount} consecutive turns.`,
        stagnantTurns: this.stagnantTurnCount,
        drift,
        turnCount: this.turnCount,
      };
    }

    return {
      tripped: false,
      stagnantTurns: this.stagnantTurnCount,
      drift,
      turnCount: this.turnCount,
    };
  }

  reset(): void {
    this.previousDiff = null;
    this.seenDiffHashes.clear();
    this.stagnantTurnCount = 0;
    this.turnCount = 0;
  }
}
