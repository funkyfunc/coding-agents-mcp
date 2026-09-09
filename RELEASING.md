# Releasing

Publishing runs in CI via npm **trusted publishing (OIDC)** — no npm token, no
2FA/security-key in the loop. `.github/workflows/release.yml` triggers on a
version tag, runs the full suite on Linux + macOS, then publishes with build
provenance. **Pushing the tag is the approval** — there is no manual gate (the
`release` environment exists only to scope the npm trusted publisher; it has no
protection rules, matching `run-mcp`).

## Per-release flow

1. Bump `version` in `package.json` and in `src/index.ts` server metadata.
2. Commit and land on `main` (green CI).
3. Tag and push:
   ```sh
   git tag -a vX.Y.Z -m "coding-agents-mcp vX.Y.Z: <summary>"
   git push origin vX.Y.Z
   ```
4. CI tests and publishes to npm via OIDC. Done.

The workflow fails fast if the tag doesn't match `package.json`, so a
mismatched tag can't publish.

## One-time setup

Both are done once and never again. **Neither can be scripted** — they are UI-only.

### 1. npm trusted publisher (on npmjs.com)

npmjs.com → the `coding-agents-mcp` package → **Settings** → **Trusted Publisher** → add a
**GitHub Actions** publisher:

- Organization / user: `funkyfunc`
- Repository: `coding-agents-mcp`
- Workflow filename: `release.yml`
- Environment: `release`

### 2. GitHub `release` environment (no protection rules)

Already initialized via `gh api repos/funkyfunc/coding-agents-mcp/environments/release -X PUT`.
Its only job is matching the trusted-publisher config above.

## Notes

- Needs npm ≥ 11.5.1 in the runner for OIDC; the workflow upgrades npm
  explicitly since `actions/setup-node` ships an older version.
- Provenance requires a public repo and `id-token: write`.
- `prepublishOnly` runs the full build (`tsc && chmod +x dist/index.js`).
- Legacy 2FA-bypass automation tokens are being restricted by npm; OIDC needs no stored secret and is the future-proof path.
- Local `npm publish` still works as a fallback but requires the interactive
  security-key/Touch ID step — prefer the CI tag path.
