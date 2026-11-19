# AGENTS.md

## Project

- Static vanilla JS Pac-Man MVP; no package manager, build, tests, lint or typecheck. Verify by opening `src/index.html` in a browser and checking gameplay/console.
- This repo teaches spec-driven development: use `/spec` before substantial feature work. It writes `specs/NN-slug.md` (`Draft` by default) and seeds `specs/.spec-config.yml`; see `.agents/skills/spec/SKILL.md` and `template.md`. `/spec` is documentation-only: do not write code in that flow.

## Wiring

- `src/index.html` is the entrypoint and loads plain scripts in dependency order: `js/maze.js`, `js/game.js`, `js/render.js`, `js/main.js`. New JS files need a matching `<script>` tag in that order; there are no ES modules/imports.
- Cross-file contract is globals: `maze.js` exports `MAZE`, `TUNNEL_ROW`, `PACMAN_START`, `GHOST_STARTS` on `window`; `game.js` exposes `createGame`, `update`, `DIRS`; `render.js` exposes `draw`; `main.js` owns the RAF loop, arrow keys and overlay.
- `MAZE` is the pristine 28x31 map and must not be mutated; `createGame()` clones it into `game.grid`. Render from `game.grid` so eaten dots disappear.

## Gameplay invariants

- Coordinates are cell units with origin top-left; tile size is 20px. Movement is fractional: Pac-Man 0.125 cells/frame, ghosts 0.1; turns, dots and collisions are evaluated when actors align to cell centers.
- Tile codes: 0 empty, 1 wall, 2 dot, 3 ghost-door. Row 14 is the wrap-around tunnel; Pac-Man is blocked by doors, ghosts are not.

## Conventions

- Spanish comments/UI text; 2-space indent, single quotes, spaces just inside parentheses (`function f( x )`).
