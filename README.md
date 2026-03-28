# Blue Prince Solver

Local solver + web UI for Mount Holly blueprint constraints.

## Run (static)

Serve the `public/` folder with any static host.

Quick local preview:

```bash
cd public
python3 -m http.server 4312
```

Open: `http://localhost:4312`

Default map is now graph mode (`data/map.default.json`) generated from the room-grid backup (`data/map.rooms.backup.json`).
It includes `knownPaths` with node-order sequences for the four reference solutions.

## Static deployment (GitHub Pages)

The app supports static-only hosting:

- Solver runs in-browser (`public/solver.browser.js`)
- Defaults/examples load from static assets (`public/data/map.default.json`, `public/data/examples.json`)
- Share links work without backend via URL payload tokens (`?share=s1.<token>`)

### Map updates

Edit `public/data/map.default.json` directly when map corrections are needed.

To regenerate graph data from room-grid sources:

```bash
npm run build:graph-map
```

## Sharing (static)

- Click **Share** in the top toolbar to create a share link.
- The link is copied to clipboard when available.
- Link format is `?share=s1.<token>`.
- Opening that link reloads shared map/query/result state.
- If the URL would be too long, result payload may be omitted while keeping map/query.

## Backend API (legacy)

This project now targets static hosting. Backend API routes are not required for deployment.

## Map formats

### Room grid mode

- Use `map.rooms`
- Room IDs are chess-like (`A1`..`E9`) plus optional entry nodes like `C0` (below `C1`)
- Each room can have:
  - `letter`
  - `lantern` (optional node-level lantern)
  - `open`: array of `N/E/S/W`
  - `sideLanterns`: per-exit lantern color(s), e.g. `{ "N": "purple", "E": ["red", "orange"] }`
  - `sideLanternRefs`: optional per-exit IDs for lantern positions, e.g. `{ "E": ["L:C1:E:0", "L:C1:E:1"] }`
  - `passLanterns`: extra lanterns encountered while moving past an edge (without entering nearest doorway), e.g. `{ "N": ["yellow"], "E": ["red", "purple"] }`
  - `passLanternRefs`: optional IDs for pass-by lantern positions, aligned with `passLanterns`
  - `neighbors`: explicit directional override (`"E": "B2"` or `"E": {"to": "B2", "lantern": "red", "lanternRef": "L:C1:E:0", "passLanterns": ["yellow"], "passLanternRefs": ["L:C1:E:P0"]}`)

If `map.defaultOpen` is `"all"`, adjacent room exits are open unless overridden.

### Graph mode

Use `map.nodes` for arbitrary intersection-level modeling (recommended when moves can occur between rooms or at hallway intersections):

```json
{
  "nodes": {
    "C0": { "neighbors": { "N": "C0:N" } },
    "C0:N": {
      "neighbors": {
        "S": "C0",
        "N": {
          "to": "C1:S",
          "lantern": "red",
          "lanternRef": "L:C0:N:0",
          "passLanterns": ["yellow"],
          "passLanternRefs": ["P:C0:N:0"]
        }
      }
    },
    "C1:S": { "neighbors": { "S": "C0:N", "N": "C1" } },
    "C1": { "letter": "E", "neighbors": { "S": "C1:S", "E": "C1:E" } },
    "C1:E": { "neighbors": { "W": "C1", "E": "D1:W" } },
    "D1:W": { "neighbors": { "W": "C1:E", "E": "D1" } },
    "D1": { "letter": "S", "neighbors": { "W": "D1:W" } }
  }
}
```

Then constrain by position/lantern nodes with query keys like:
- `mustUseLanternRefs: ["L:C1:S:0"]`
- `lanternRefOrder: ["L:C1:S:0", "L:C2:E:1"]`

## Letter mode options

`query.letterMode` supports:

- `"any_order"` (default) / `"any"`:
  - Exact multiset matching when letter requirements are provided
  - No extra letter visits are allowed beyond required counts
- `"ordered"` / `"ordered_strict"` / `"strict"`:
  - Exact ordered matching
  - Every visited letter room must match the next required letter
  - No extra letters are allowed after the sequence is complete
- `"ordered_subsequence"` / `"subsequence"`:
  - Backward-compatible alias of ordered mode (also no extra letters)

Letter list aliases: `mustUseLetters`, `orderedLetters`, `letterOrder`, or `letters`.

Note: letters are counted when a room node is visited, including the `endId` room if it has a letter.

## Path-shape controls (crossing / circuit behavior)

- `simplePath: true` (default): disallow revisiting previously visited nodes
  - Prevents self-crossing and most circuiting loops
- `simplePath: false`: allow revisits (legacy permissive behavior)

Aliases to relax simple-path mode:
- `allowCrossing: true`
- `allowCircuit: true` / `allowCircuits: true`
- `allowLoops: true`

Search controls:
- `searchMode: "dfs" | "bfs"` (auto-selects DFS for ordered-letter + simple-path queries)
- `maxStates` (hard-capped to 250000 for memory safety)

## Turn-rule keys

`query.lantern.turnRules` supports color keys (`blue`, `red`, `orange`, `yellow`, `green`, `purple`) and an intersection/no-lantern key:

- `intersection` (preferred)
- aliases: `no_lantern`, `no-lantern`, `none`, `default`, `hallway`

Example:

```json
{
  "lantern": {
    "turnRules": {
      "blue": "left",
      "red": "left",
      "intersection": "straight"
    }
  }
}
```

## Simulation mode

Run a deterministic simulation without solving for an objective:

```json
{
  "mode": "simulate",
  "startId": "g(vC1)",
  "maxSteps": 180,
  "simulation": {
    "initialHeading": "N",
    "stopOnLoop": true
  }
}
```

Notes:
- `maxSteps` / `maxMoves` controls simulation length.
- Simulation follows the first valid transition under the current direction priority.
- `path.steps` counts room in/out moves; `path.moveCount` is total moves.
