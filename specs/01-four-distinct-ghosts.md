# SPEC 01 — Cuatro fantasmas con comportamientos propios

> **Status:** Approved
> **Depends on:** Ninguna
> **Date:** 2026-11-18
> **Objective:** Incorporar cuatro fantasmas con comportamientos distintos —Blinky persigue agresivamente con BFS, Pinky embosca, Inky flanquea y Clyde huye al acercarse— sin cambiar las reglas de movimiento del juego.

## Por qué este spec existe

El MVP solo tiene dos fantasmas: `hunter` (Manhattan codiciosa) y `random`. La caza codiciosa se atasca contra muros y dos IA no bastan para diferenciar perseguidores.

## Scope

**In:**

- `src/js/maze.js`: `GHOST_STARTS` pasa a 4 entradas con `kind` `blinky`, `pinky`, `inky`, `clyde` en (12,14), (13,14), (14,14), (15,14), en ese orden.
- `src/js/game.js`: helper `shortestPathStep( grid, from, to, currentDir )` con BFS sobre `game.grid` y desempate a favor de `currentDir`.
- `src/js/game.js`: `ghostTarget( game, g )` con las cuatro reglas de destino y despacho por `g.kind` desde `decideGhost`.
- Acotar los objetivos fuera del laberinto al rango válido antes del BFS.
- `resetPositions` continúa reiniciando a los cuatro desde `GHOST_STARTS` por índice.

**Out of scope (for future specs):**

- Power pellets, modo miedo y puntos por comer fantasmas.
- Fases globales alternas scatter/caza por temporizador.
- Cambios en `src/js/render.js` ni en `src/index.html`.
- Archivos JS nuevos, módulos ES, build y tests automáticos.
- Persistencia, niveles y highscores.

## Data model

```js
// src/js/maze.js
const GHOST_STARTS = [
  { x: 12, y: 14, kind: 'blinky' },
  { x: 13, y: 14, kind: 'pinky' },
  { x: 14, y: 14, kind: 'inky' },
  { x: 15, y: 14, kind: 'clyde' },
];

// src/js/game.js — cada elemento de game.ghosts
{
  x: number,
  y: number,
  dir: 'left' | 'right' | 'up' | 'down',
  speed: 0.1,
  kind: 'blinky' | 'pinky' | 'inky' | 'clyde',
}

// Valor devuelto por ghostTarget( game, g )
{ x: number, y: number } // celda destino, ya acotada al laberinto
```

Convenciones: coordenadas en celdas, origen arriba-izquierda; BFS sobre la copia `game.grid`; los fantasmas atraviesan puertas (3) pero no muros (1); el túnel solo existe en la fila 14.

Reglas de `ghostTarget`:

- `blinky`: celda redondeada de Pac-Man.
- `pinky`: 4 celdas en `pacman.dir` desde la celda redondeada de Pac-Man.
- `inky`: siendo `ahead` la celda 2 por delante de Pac-Man y `b` la celda de Blinky, objetivo `2*ahead - b`.
- `clyde`: si `sqrt(dx²+dy²) > 8` apunta a Pac-Man; si no, apunta a `(1,29)`.

## Implementation plan

1. En `src/js/maze.js`, sustituir `GHOST_STARTS` por las 4 entradas indicadas. Verificar: arranca el juego y se dibujan 4 fantasmas sin errores en consola.
2. En `src/js/game.js`, añadir `shortestPathStep`: BFS desde la celda redondeada del fantasma considerando las 4 direcciones transitables, sin excluir la inversa, con desempate a favor de `g.dir`. Hacer que `decideGhost` lo use con la celda de Pac-Man como objetivo común. Verificar: los 4 fantasmas persiguen y el juego sigue siendo jugable.
3. En `src/js/game.js`, añadir `ghostTarget` con acotado de coordenadas y las 4 reglas, y pasar el objetivo según `g.kind` desde `decideGhost`. Verificar: con Pac-Man quieto, Blinky se acerca, Pinky apunta por delante, Inky cambia con Blinky y Clyde se retira al estar cerca.

## Acceptance criteria

- [ ] Al iniciar aparecen exactamente 4 fantasmas en (12,14), (13,14), (14,14) y (15,14), sin errores en consola.
- [ ] Los colores por índice son rojo, rosa, cian y naranja en ese orden.
- [ ] Cada fantasma tiene un `kind` distinto: `blinky`, `pinky`, `inky`, `clyde`.
- [ ] Blinky elige en cada decisión el primer paso de un camino mínimo hasta la celda de Pac-Man.
- [ ] En un pasillo recto con Pac-Man quieto, Blinky reduce su distancia en decisiones consecutivas.
- [ ] Pinky apunta 4 celdas por delante de la dirección de Pac-Man; al girar Pac-Man, su objetivo cambia.
- [ ] Inky calcula `2*ahead - posición de Blinky`; si Blinky se mueve, su objetivo cambia.
- [ ] Clyde apunta a Pac-Man con distancia euclidiana > 8 y a (1,29) con distancia <= 8.
- [ ] Ningún fantasma atraviesa muros (1) y todos cruzan la puerta (3) y el túnel de la fila 14.
- [ ] Tras una colisión, los 4 fantasmas vuelven a sus posiciones iniciales y las vidas bajan en 1.
- [ ] El juego termina en `won` al comer todos los dots y en `lost` al agotar las vidas.

## Decisions

- **Sí:** los cuatro fantasmas clásicos. El usuario pidió comportamientos propios y el original es la referencia del proyecto.
- **Sí:** BFS para Blinky en lugar de Manhattan codiciosa. Evita los atascos del `hunter` actual.
- **Sí:** desempate a favor de la dirección actual. Reduce el temblor visual.
- **Sí:** la inversa no se excluye del BFS; solo se usa como desempate. El camino mínimo puede requerir girar 180°.
- **Sí:** objetivos fuera del mapa se acotan al rango válido. Mantiene el BFS siempre definido.
- **Sí:** distancia euclidiana para el umbral de Clyde. Coherente con las reglas clásicas elegidas.
- **No:** power pellets ni modo miedo. No existen hoy y multiplicarían el alcance.
- **No:** archivo `ghost-ai.js`. Cuatro reglas caben en `game.js` y evitan tocar `index.html`.
- **No:** colores por `kind` en `render.js`. El orden de `GHOST_STARTS` ya fija la correspondencia con `GHOST_COLORS`.
- **No:** fases scatter globales. Clyde ya tiene su esquina; un calendario de fases va en otro spec.

## Risks

| Riesgo | Mitigación |
| --- | --- |
| BFS ejecutado 4 veces por decisión | El laberinto tiene 868 celdas y las decisiones solo ocurren al alinear celdas; medir en navegador. |
| Objetivos de Pinky/Inky dentro de una pared | El objetivo es solo referencia para el BFS; se acota y el camino llega a la celda alcanzable más cercana. |
| Fantasmas compartiendo celda al salir del pen | Posiciones iniciales distintas y `break` en el bucle de colisiones de `update`. |

## What is **not** in this spec

- Power pellets, modo miedo ni puntuación por fantasmas.
- Fases scatter/caza globales por temporizador.
- Cambios en `render.js` o `index.html`, ni archivos JS nuevos.
