# TenderLens — Claude Context Pack

## How to use this pack
1. Create a **private GitHub repository** named `tenderlens`.
2. Extract these files into the repository root and commit them before feature implementation.
3. Add `PROJECT_BRIEF.md`, `ARCHITECTURE.md`, `TEAM_WORKFLOW.md`, and `INTEGRATION_CONTRACTS.md` to Claude's Project/Context knowledge area if your Claude interface supports project files.
4. Keep `CLAUDE.md` in the repository root. Claude Code can read it when working in the repository.
5. Use `FIRST_FEATURE_PROMPT.md` when starting Feature 1.
6. After each feature, test it, update `DEVELOPMENT_STATUS.md`, commit it, and only then begin dependent features.

## Important
- These files document the **planned** architecture. Claude must inspect the actual repository before implementing anything.
- If existing code differs from this plan, preserve working code and propose necessary changes first.
- Never upload real `.env` files, passwords, API keys, database credentials, private customer documents, or other secrets.
- This ZIP contains documentation only, not application source code.
