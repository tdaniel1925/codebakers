# /DESIGN - Clone from Mockups

**Purpose:** Analyze visual designs (mockups, screenshots, websites) and generate pixel-perfect matching code.

## Usage

```
/design ./mockups              # Scan folder of images
/design ./mockups/dashboard.png # Single image
/design https://linear.app     # Clone website design
/design "like Notion"          # Reference known style
```

## When /design is triggered:

1. **Detect input type**
   - Folder path → Scan all images
   - Single file → Analyze that image
   - URL → Screenshot and analyze
   - Quote → Apply known style reference

2. **Load pattern module**
   - Load `09-design.md` for design clone analysis workflow

3. **Analyze the design**

```
Design Analysis

Scanning: ./mockups (5 images found)

Extracting:
  - Color palette (primary, neutrals, semantic)
  - Typography (fonts, sizes, weights)
  - Spacing system (padding, margins, gaps)
  - Border styles (radius, shadows)
  - Component patterns

Processing...
```

## Design Extraction

For each image, extract:

```
Design System Extracted:

Colors:
  Primary: #0ea5e9 (Blue)
  Neutral: 10-shade gray scale
  Success/Warning/Error: Semantic colors

Typography:
  Font: Inter (Sans-serif)
  Scale: 12px - 48px (8 sizes)
  Weights: 400, 500, 600, 700

Spacing:
  Base unit: 4px
  Scale: 0 - 96px

Components Detected:
  - Sidebar navigation (280px, dark)
  - Stats cards (icon + value + label)
  - Data table (striped, sortable)
  - Form inputs (40px height, 8px radius)
  - Buttons (4 variants)
```

## Code Generation

Generate:
- **Tailwind config** with exact colors, fonts, spacing
- **UI components** matching the design
- **Page layouts** replicating the mockups

## Reference Styles

| Reference | Style |
|-----------|-------|
| "like Linear" | Dark, purple accent, minimal |
| "like Notion" | Light, clean, content-focused |
| "like Stripe" | Professional, purple, polished |
| "like Vercel" | Black/white, developer-focused |
