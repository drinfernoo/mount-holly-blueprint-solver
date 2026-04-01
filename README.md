# Mount Holly Blueprint Solver

A browser app for finding valid routes through the Mount Holly blueprint.

It can:
- search for a route that matches your constraints (**Solve** mode), or
- run a deterministic step-by-step traversal with your rules (**Simulate** mode).

---

## Quick start (normal usage)

```bash
npm start
```

Then open:

`http://localhost:4312`

That’s it.

---

## How to use the app

1. **Pick a mode**
   - **Solve**: search for a valid route from start to end.
   - **Simulate**: follow one run path under your current rules.

2. **Set Start / End**
   - Use **Add constraint → Start node / End node**, or
   - click **Pick start on map** / **Pick end on map**.

3. **Add optional constraints**
   - **Required room**: force the route through specific rooms.
   - **Must-use letters** + **Letter mode**: constrain collected letters.
   - **Start lantern color** / **Allowed lantern color**.
   - **Simple path**: keep enabled to avoid loops and revisits.

4. **Add turn rules (optional)**
   - Example: `red → right`, `intersection → straight`.
   - These apply when traversing that lantern color (or no-lantern intersections).

5. **Run it**
   - Click **Solve route** in Solve mode.
   - Click **Run simulation** in Simulate mode.

6. **Read results**
   - **Summary** = high-level status.
   - **Cards** = key stats.
   - **Warnings / Unmet constraints** = why a route failed your rules.
   - **Moves / Visited rooms / Path nodes** = full route trace.

---

## Constraint cheat sheet

- **Start node**: where traversal begins.
- **End node**: target destination (optional in simulation).
- **Required room**: one or more rooms that must appear in the route.
- **Letter mode**:
  - `any_order` (default): required letters can appear in any order.
  - `ordered`: letters must be encountered in order.
  - `ordered_strict`: strict ordered behavior.
- **Must-use letters**: letters the route must collect.
- **Start lantern color**: initial color state before movement.
- **Allowed lantern color**: whitelist of lantern colors the route may use.
- **Simple path**:
  - `Enabled` (recommended): no node revisits/loops.
  - `Disabled`: allows loopier search space.

---

## Sharing

Use **Share** in the top toolbar.

- The app creates a URL token (`?share=s1.<token>`).
- Opening that URL restores map/query state.
- If payload is too large, result details may be trimmed while keeping map/query.

---

## Developer notes (supplemental)

The app is static-host friendly:
- solver runs in-browser (`public/solver.browser.js`)
- map/examples are static JSON assets (`public/data/*.json`)

### Useful scripts

```bash
npm start                       # local static preview (port 4312)
npm run serve                   # same as start
npm run build:graph-map         # regenerate graph map from room-grid source
npm run populate:known-paths    # fill known path metadata
npm run rebuild:map             # run both map rebuild steps
npm run apply-notation-path     # apply notation path helper
```

### Data files

- `public/data/map.default.json` → current map graph used by the app
- `public/data/examples.json` → example queries shown in UI

### Map updates

If map logic changes, update `public/data/map.default.json` directly or rebuild with scripts above.
