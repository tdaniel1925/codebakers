# Canvas Mode Redesign Plan

## Overview
Transform CodeBakers from a chat-first interface to a visual-first canvas with integrated chat. Users see their app architecture as the primary view, with chat as a supporting tool.

---

## Phase 1: View Mode Infrastructure

### 1.1 Add View Mode State
- Add `viewMode: 'canvas' | 'classic'` state variable
- Store preference in VS Code settings (`codebakers.defaultViewMode`)
- Default to `'canvas'`

### 1.2 Add View Toggle Buttons
Location: Header bar, right side

```
[🗺️ Canvas] [💬 Classic]
```

- Active mode gets highlighted button style
- Clicking toggles between modes
- Keyboard shortcut: `Ctrl+Shift+V`

### 1.3 Conditional Rendering
- When `viewMode === 'canvas'`: Show Canvas Mode layout
- When `viewMode === 'classic'`: Show current chat layout (mostly unchanged)
- Both modes share the same underlying data (nodes, messages, pending changes)

---

## Phase 2: Canvas Mode Layout

### 2.1 Main Structure
```
┌─────────────────────────────────────────────────────────────┐
│ Header: Logo + View Toggle + Pending Badge                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                    Canvas Area (90%)                        │
│              (Vertical cascade Mind Map)                    │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ AI Response Bar (collapsible, ~60px when collapsed)         │
├─────────────────────────────────────────────────────────────┤
│ Chat Input Bar (~50px)                                      │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Canvas Area
- Reuse existing vertical cascade Mind Map from v1.0.76
- Make it full-width (no split screen)
- Add `[+ Add]` buttons to each section for manual node creation
- Keep tooltips, hover effects, drag visual feedback

### 2.3 AI Response Bar
States:
- **Collapsed** (default): Single line showing last action summary
  - "✨ Added Hero component" or "Waiting for input..."
- **Expanded**: Shows full response with code preview
  - Triggered by clicking the bar or when code is generated
  - Max height: 40% of viewport
  - Scrollable content
  - [Collapse] button to minimize

### 2.4 Chat Input Bar
- Single textarea that expands on focus (1-3 lines)
- Shows context when node selected: `[📄 LoginPage] Ask about this...`
- Send button + Voice button
- Cancel button (visible during streaming)

---

## Phase 3: Pending Changes Notification System

### 3.1 Remove Inline Pending Section
- Delete the current pending changes section from main view
- Remove accept/reject buttons from message cards

### 3.2 Add Pending Badge
Location: Header bar, right side (before settings icon)

```
🔔 3
```

- Shows count of pending changes
- Hidden when count is 0
- Pulses briefly when new changes arrive
- Click to open slide-out panel

### 3.3 Slide-Out Panel
Triggered by: Clicking badge

```
┌──────────────────────────────────────┬─────────────────────┐
│                                      │ Pending Changes (3) │
│                                      ├─────────────────────│
│        (Main canvas visible)         │ ☐ Hero.tsx          │
│                                      │ ☐ page.tsx          │
│                                      │ ☐ schema.ts         │
│                                      │                     │
│                                      │ [✓ Accept All]      │
│                                      │ [✗ Reject All]      │
│                                      ├─────────────────────│
│                                      │ Applied (2)         │
│                                      │ ✓ Header.tsx        │
│                                      │ ✓ Footer.tsx        │
└──────────────────────────────────────┴─────────────────────┘
```

Features:
- Width: ~280px, slides in from right
- Click outside or X button to close
- Individual file checkboxes (optional granular control)
- Accept All / Reject All buttons
- History of recently applied changes
- Each file row: Click to preview diff

### 3.4 Quick Accept (Optional)
- Hover badge shows tooltip: "3 pending · [Accept All]"
- One-click accept without opening panel for power users

---

## Phase 4: Node Interactions in Canvas Mode

### 4.1 Node Selection
- Click node → Selection ring appears (blue border)
- Selected node ID stored in state
- Chat input shows context: `[🧩 Hero] Type here...`

### 4.2 Node Action Buttons
On hover or selection, show small action buttons:
```
┌──────────────────┐
│ 🧩 Hero Section  │
├──────────────────┤
│ [✏️] [🗑️] [⚡]   │
└──────────────────┘
```
- ✏️ Edit: Opens inline edit mode for name/description
- 🗑️ Delete: Removes node (with confirmation)
- ⚡ Generate: Generate code for just this node

### 4.3 Add Node Buttons
Each section has an `[+ Add]` button:
```
┌─────────────────────────────────────────────────────────────┐
│ PAGES                                                       │
│ ┌────────┐ ┌────────┐ ┌────────────────┐                   │
│ │ Home   │ │ Login  │ │ + Add Page     │                   │
│ └────────┘ └────────┘ └────────────────┘                   │
└─────────────────────────────────────────────────────────────┘
```
- Click → Opens small form or uses AI: "What page do you want to add?"

---

## Phase 5: Classic Mode Preservation

### 5.1 Keep Existing Chat Layout
- Current layout remains accessible via toggle
- Messages section, pending changes inline, etc.
- For users who prefer text-heavy interface

### 5.2 Shared State
Both modes read/write to same state:
- `_messages[]`
- `_pendingChanges[]`
- `previewNodesData[]`
- `selectedNodeId`

Switching modes is instant - no data loss.

---

## Phase 6: Settings & Persistence

### 6.1 New Settings
```json
{
  "codebakers.defaultViewMode": {
    "type": "string",
    "enum": ["canvas", "classic"],
    "default": "canvas",
    "description": "Default view mode when opening CodeBakers"
  },
  "codebakers.autoAcceptChanges": {
    "type": "boolean",
    "default": false,
    "description": "Automatically accept all file changes without review"
  }
}
```

### 6.2 Persist View Mode
- Remember last used mode in workspace state
- Restore on next open

---

## Implementation Order

### v1.0.77: Foundation
1. Add view mode state and toggle buttons
2. Add basic Canvas Mode layout (full-screen Mind Map)
3. Keep Classic Mode working as-is

### v1.0.78: Pending Changes Redesign
1. Add pending badge to header
2. Create slide-out panel
3. Remove inline pending section from Classic Mode too (optional)

### v1.0.79: Canvas Enhancements
1. Add AI Response Bar (collapsible)
2. Add node selection + context in chat input
3. Add node action buttons (edit/delete/generate)

### v1.0.80: Polish
1. Add [+ Add] buttons to sections
2. Add settings for preferences
3. Keyboard shortcuts
4. Animations and transitions

---

## Files to Modify

| File | Changes |
|------|---------|
| `ChatPanelProvider.ts` | Main implementation - view modes, layouts, pending panel |
| `extension/package.json` | Add new settings, bump version |
| `planner/types.ts` | Add any new message types if needed |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Breaking existing users | Classic Mode preserves current UX |
| Complex state management | Both modes share same state, just different rendering |
| Performance with large canvases | Already handled in v1.0.76 with scrolling |

---

## Success Metrics

- Canvas Mode becomes preferred by new users
- Reduced time-to-first-code for beginners
- Accept All usage validates notification approach
