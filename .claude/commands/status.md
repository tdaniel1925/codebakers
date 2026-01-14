# /STATUS - See Where You Are

**Purpose:** Show current project state, progress, what's built, what's next.

## When /status is triggered:

Read `.codebakers.json` and display:

```
Project Status: [Project Name]

**Build Progress:**
Phase 1: Foundation                          100%
Phase 2: Authentication                      100%
Phase 3: Core Features                        50%
Phase 4: Payments                              0%
Phase 5: Polish                                0%

**Overall: 18/42 tasks (43%)**

**What's Built:**
- Auth system (login, signup, OAuth)
- Database schema
- [Other completed features]

**In Progress:**
- [Current task]

**Up Next:**
- [Next task]

**Stats:**
- Files created: 47
- Tests: 12 passing, 0 failing
- Last updated: [timestamp]

Continue building? Just say "continue" or ask about a specific area.
```

## If No Project Exists:

```
No Project Found

You don't have a CodeBakers project in this directory.

- Run `/build [your idea]` to start a new project
- Run `/audit` to analyze existing code
```
