# MCP Tools Reference

**This is the #1 priority rule. Before doing ANYTHING, check if an MCP tool can handle it.**

## Core Tools (ALWAYS call these)

| User Says | MCP Tool to Call | What It Does |
|-----------|------------------|--------------|
| *Before writing ANY code* | `discover_patterns` | **MANDATORY** - Finds patterns and existing code to follow |
| *Before saying "done"* | `validate_complete` | **MANDATORY** - Validates patterns used, tests exist and pass |

## Project Tools

| User Says | MCP Tool to Call | What It Does |
|-----------|------------------|--------------|
| "upgrade codebakers", "update patterns" | `update_patterns` | Downloads latest CLAUDE.md + modules from server |
| "audit my code", "review code" | `run_audit` | Runs comprehensive code audit |
| "fix this", "auto-fix", "heal" | `heal` | AI-powered error diagnosis and repair |
| "create project", "new project" | `scaffold_project` | Creates complete project from description |
| "init codebakers", "add patterns" | `init_project` | Adds patterns to existing project |
| "what's my status", "progress" | `project_status` | Shows build progress and current state |
| "run tests" | `run_tests` | Executes test suite |
| "deploy", "check vercel" | `vercel_logs` | Gets Vercel deployment logs |
| "billing", "subscription" | `billing_action` | Opens billing portal |
| "add a page" | `add_page` | Scaffolds new page with patterns |
| "add api route" | `add_api_route` | Creates API route with best practices |
| Ambiguous request | `detect_intent` | Analyzes intent and asks for confirmation |

## VAPI Voice AI Tools

| User Says | MCP Tool to Call | What It Does |
|-----------|------------------|--------------|
| "connect vapi", "setup voice ai" | `vapi_connect` | Sets up VAPI API credentials |
| "show my assistants" | `vapi_list_assistants` | Lists all VAPI voice assistants |
| "create voice assistant" | `vapi_create_assistant` | Creates assistant with best practices |
| "get assistant details" | `vapi_get_assistant` | Gets specific assistant configuration |
| "update assistant" | `vapi_update_assistant` | Updates assistant settings |
| "show call history" | `vapi_get_calls` | Gets call logs with transcripts |
| "call details" | `vapi_get_call` | Gets specific call transcript/recording |
| "add vapi webhook" | `vapi_generate_webhook` | Generates Next.js webhook handler |

## Refactoring Tools

| User Says | MCP Tool to Call | What It Does |
|-----------|------------------|--------------|
| "check impact", "what files use X" | `ripple_check` | Finds all files affected by a change |
| "check wiring", "check dependencies" | `coherence_audit` | Full coherence check on codebase |

**Ripple Check Usage:**
- Run BEFORE making breaking changes to see impact
- Run AFTER changes to verify all files updated
- Provides categorized list: high/medium/low impact

## Dependency Guardian (Auto-Coherence)

**AUTOMATIC - Runs silently after code generation.**

| Tool | When It Runs | What It Does |
|------|--------------|--------------|
| `guardian_analyze` | After every code generation | Scans for broken imports, type errors |
| `guardian_heal` | When issues are found | Auto-fixes what's possible |
| `guardian_verify` | After fixes applied | Runs TypeScript check |
| `guardian_status` | On request | Shows project health score |

**What Guardian Checks:**
- Broken imports (file doesn't exist)
- Missing exports (import something not exported)
- Type mismatches (string vs number, etc.)
- API routes without error handling
- Unused imports
- console.log in production code
- `any` type usage
- Missing return types
- TODO/FIXME comments

**Auto-Fix Capabilities:**
- Remove unused imports
- Remove console.log statements
- Add missing error handling patterns
- Update import paths

## MCP-First Rules

1. **ALWAYS** check if the user's request maps to an MCP tool
2. **ALWAYS** call the MCP tool instead of doing it manually
3. **NEVER** offer to "create pattern files" - use `update_patterns`
4. **NEVER** manually write audit reports - use `run_audit`

## Auto-Execute Tools (No Confirmation Needed)

These tools should run IMMEDIATELY without asking:
- `update_patterns` - Just run it when user says "upgrade codebakers"
- `project_status` - Just show the status
- `run_audit` - Just run the audit
- `billing_action` - Just open billing
