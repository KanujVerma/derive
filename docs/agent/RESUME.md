# Agent Resume Workflow

This guide establishes the standardized procedure for any coding agent (Kanuj's or Sami's) resuming work on the Derive repository.

---

## Resume Procedure (Step-by-Step)

1. **Inspect HEAD & Current Branch**:
   ```bash
   git status
   git branch --show-current
   ```
2. **Inspect Recent Commits**:
   ```bash
   git log -n 5 --oneline
   ```
3. **Read Roadmaps & Workstream Assignment**:
   Read [`docs/ROADMAP.md`](../ROADMAP.md) to locate the current active milestone (e.g. K1–K5 for Kanuj, S1–S5 for Sami).
4. **Read Relevant Handoff**:
   Check if a handoff document exists in `docs/agent/` for the current branch or task.
5. **Inspect Verification State**:
   Confirm whether tests and typechecks are passing:
   ```bash
   npm test
   npx tsc --noEmit
   ```
6. **Trust Repository State Over Prompt Memory**:
   The current working tree and test suite are authoritative. Do not assume or hallucinate previous states.
7. **Continue from Accepted Work**:
   Never start from scratch or rewrite existing verified components without an explicit, verifiable technical rationale.
