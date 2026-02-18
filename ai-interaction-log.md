# AI Interaction Log

## Overview

I used Claude Opus 4.6 (via Claude Code CLI) to help scaffold the boilerplate structure of my Hong Kong Temperature Matrix View project. All D3.js visualization logic was implemented by me manually.

---

## Session 1: Project Setup & Boilerplate Generation

### Prompt 1
> I need to create a D3.js project for a matrix view of Hong Kong monthly temperatures. Can you set up the boilerplate files — HTML, CSS, and a JS file with the module structure, constants, and function signatures?

### AI Response
Claude generated three files:

**`index.html`** — Standard HTML5 document that:
- Loads D3.js v7 from CDN
- Links `style.css` and `main.js`
- Contains the page heading, a mode label paragraph, a `#chart` div, and a `#tooltip` div

**`style.css`** — Base styles including:
- Page layout (font, margins, background)
- Tooltip positioning and appearance (absolute, semi-transparent, hidden by default)
- CSS classes for matrix cells (`.cell`), mini line chart strokes (`.line-max`, `.line-min`), axes, and legend labels

**`main.js`** — Module skeleton with:
- Constants section: `MARGIN`, `CELL_WIDTH`, `CELL_HEIGHT`, `YEARS_COUNT`, `MONTHS_COUNT`, computed `WIDTH`/`HEIGHT`, `MONTH_NAMES` array, `TEMP_MIN`/`TEMP_MAX` range, and `showMax` state variable
- Function signatures with JSDoc comments and TODO instructions:
  - `loadData()` — load and process CSV
  - `summariseMonth()` — compute monthly aggregates
  - `buildColourScale()` — create colour mapping
  - `createSvg()` — set up the SVG canvas
  - `drawAxes()` — render x/y axes
  - `drawCells()` — draw coloured rectangles with tooltips
  - `drawMiniCharts()` — daily line charts per cell
  - `drawLegend()` — colour scale legend
  - `toggleMode()` — click interaction to switch max/min
  - `main()` — orchestration entry point

### Prompt 2
> Clean up the bun/TypeScript config files — they aren't needed for a static HTML+JS+CSS project.

### AI Response
Claude removed `package.json`, `bun.lock`, `tsconfig.json`, `main.ts`, and `node_modules/`, and simplified `.gitignore` to only cover OS/editor files.

---

## Session 2: Code Review Before Testing

### Prompt 3
> I've finished implementing all the D3 logic. Can you review my code for bugs before I test it?

### AI Response
Claude reviewed the full `main.js` and found one issue:

**Bug (line 223-225):** In the `drawCells()` mouseover handler, there was a missing `+` string concatenation operator between two template literals and a stray extra `<br/>` tag. This would cause a `SyntaxError` at runtime, preventing the entire visualization from loading. Claude fixed the line to properly concatenate the tooltip HTML string.

All other functions were confirmed correct — data loading, scales, axes, cell rendering, mini line charts, legend, and toggle interaction all passed review with no issues.

---

## What I Built Myself

All D3.js implementation logic inside the TODO-marked function bodies:

1. **Data loading & parsing** — `d3.csv()` call, date parsing with `d3.timeParse`, year filtering, `d3.group()` nesting
2. **Monthly aggregation** — `d3.max()` / `d3.min()` computations, date sorting
3. **Colour scale** — `d3.scaleSequential()` with `d3.interpolateYlOrRd`
4. **SVG creation** — D3 select/append/attr chain
5. **Axes** — `d3.scaleBand()` configuration, `d3.axisTop()` / `d3.axisLeft()` with tick formatting
6. **Matrix cells** — Data join pattern (selectAll/data/enter/append), rect attributes, colour fill logic
7. **Tooltip interaction** — mouseover/mousemove/mouseout event handlers, dynamic HTML content, cursor-relative positioning
8. **Click toggle** — Boolean flip, transition with `d3.transition()`, re-colouring cells
9. **Mini line charts** — Per-cell `d3.scaleLinear()` scales, `d3.line()` generators with `d3.curveMonotoneX`, path rendering for daily max and min
10. **Colour legend** — SVG `<linearGradient>` with sampled stops, positioned rect and text labels

## Reflection

Using AI for boilerplate generation was helpful for:
- Quickly establishing a clean project structure without build tool overhead
- Getting the right HTML/CSS patterns for tooltips and SVG styling
- Defining a clear modular function layout with descriptive JSDoc before writing any logic

The actual D3 visualization work — data joins, scales, axes, line generators, event handling — required understanding the D3 API and the specific data shape, which I implemented myself by following the TODO comments as a guide.
