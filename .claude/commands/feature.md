# /FEATURE - Add to Existing Project

**Purpose:** Project exists, user wants to add a capability that integrates properly.

## When /feature is triggered:

1. **Check if project exists** (has .codebakers.json)
   - If NO: "No project found. Did you mean `/build` to start a new project?"
   - If YES: Proceed

2. **Read existing context**
   ```
   Reading project context...

   Found: [Project Name]
   - Auth: [status]
   - Database: [status]
   - Payments: [status]
   - Built features: [list]
   ```

## Feature Discovery

Ask targeted questions:

```
Adding Feature: [user's request]

Let me understand how this should work:

1. **Integration**
   - How does this connect to existing features?
   - Who can access this? (all users, specific roles, premium only?)

2. **Behavior**
   - What triggers this feature?
   - What's the expected output/result?
```

## Integration Analysis

Analyze how feature connects to existing code:

```
Integration Analysis

This feature will connect to:
- [existing table/API] (already exists)
- [new table/component] (will create)

Files to modify:
- [list of files]

Files that stay unchanged:
- [list of files]
```

## Feature Execution

After user approves:
1. Update .codebakers.json with feature info
2. Build feature following the spec
3. Run tests including integration tests
4. Report completion
