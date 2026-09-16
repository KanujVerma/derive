# Agent Checkpoint Workflow

This guide establishes the standardized procedure for checkpointing accepted work on the Derive repository before wrapping up or transitioning tasks.

---

## Checkpoint Procedure (Step-by-Step)

1. **Run Full Verification Suite**:
   ```bash
   npm test
   npx tsc --noEmit
   EXPO_NO_TELEMETRY=1 npx expo export -p web
   ```
2. **Inspect Git Working Tree & Diff**:
   ```bash
   git status
   git diff --stat
   ```
3. **Verify Zero Secrets or Customer Health Data**:
   Ensure no API keys, private tokens, personal names, or photo files are staged.
4. **Update Documentation / Contracts if Modified**:
   Update `docs/` and interface documentation if shared contracts were altered with mutual agreement.
5. **Create Coherent Atomic Commit**:
   Use conventional prefixes (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`):
   ```bash
   git add <files>
   git commit -m "feat(scope): concise description of verified change"
   ```
6. **Push Branch**:
   ```bash
   git push origin <branch-name>
   ```
7. **Proceed to Next Task or Generate Session Handoff**:
   If stopping with work in progress or transferring to the other founder, generate a session handoff using [`HANDOFF_TEMPLATE.md`](HANDOFF_TEMPLATE.md).
