// game.js
// Estado y reglas. Depende de globals de maze.js: MAZE, TUNNEL_ROW,
// PACMAN_START, GHOST_STARTS.

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

const PACMAN_SPEED = 0.125; // 1/8 celda/frame -> alinea cada 8 frames
const GHOST_SPEED = 0.1;    // 1/10 celda/frame

// Crea una partida nueva. Copia MAZE (pristino) a game.grid para poder comer
// dots sin destruir el original, y reiniciar.
function createGame() {
  const grid = MAZE.map( ( row ) => row.slice() );
  // La celda de inicio de Pacman arranca sin dot.
  grid[ PACMAN_START.y ][ PACMAN_START.x ] = 0;

  let dots = 0;
  for ( const row of grid ) for ( const v of row ) if ( v === 2 ) dots++;

  return {
    state: 'start',
    score: 0,
    lives: 3,
    dotsRemaining: dots,
    grid,
    pacman: {
      x: PACMAN_START.x,
      y: PACMAN_START.y,
      dir: 'left',
      nextDir: null,
      speed: PACMAN_SPEED,
    },
    ghosts: GHOST_STARTS.map( ( g ) => ( {
      x: g.x,
      y: g.y,
      dir: 'up',
      speed: GHOST_SPEED,
      kind: g.kind,
    } ) ),
  };
}

function aligned( v ) {
  return Math.abs( v - Math.round( v ) ) < 1e-3;
}

// Una celda es muro para el actor dado?
//   pacman: bloqueado por pared (1) y puerta (3)
//   ghost:  bloqueado solo por pared (1)
function isWall( grid, x, y, actor ) {
  if ( y < 0 || y >= grid.length ) return true;
  if ( x < 0 || x >= grid[ 0 ].length ) return true;
  const v = grid[ y ][ x ];
  if ( v === 1 ) return true;
  if ( v === 3 && actor === 'pacman' ) return true;
  return false;
}

// Puede el actor avanzar desde (x,y) en la direccion dir?
function canMove( grid, x, y, dir, actor ) {
  const d = DIRS[ dir ];
  if ( !d ) return false;
  const tx = x + d.x;
  const ty = y + d.y;
  // Tunel: salir por un borde en la fila del tunel siempre es valido.
  if ( ty === TUNNEL_ROW && ( tx < 0 || tx >= grid[ 0 ].length ) ) return true;
  return !isWall( grid, tx, ty, actor );
}

function wrapTunnel( a, width ) {
  if ( Math.round( a.y ) === TUNNEL_ROW ) {
    if ( a.x < 0 ) a.x += width;
    else if ( a.x >= width ) a.x -= width;
  }
}

function movePacman( game ) {
  const p = game.pacman;
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( p.x ) && aligned( p.y ) ) {
    p.x = Math.round( p.x );
    p.y = Math.round( p.y );

    // Aplicar giro pendiente si es posible.
    if ( p.nextDir && canMove( grid, p.x, p.y, p.nextDir, 'pacman' ) ) {
      p.dir = p.nextDir;
      p.nextDir = null;
    }
    // Comer dot.
    if ( grid[ p.y ][ p.x ] === 2 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += 10;
      game.dotsRemaining--;
    }
    // Si no puede seguir, se detiene en la celda.
    if ( !canMove( grid, p.x, p.y, p.dir, 'pacman' ) ) return;
  }

  const d = DIRS[ p.dir ];
  p.x += d.x * p.speed;
  p.y += d.y * p.speed;
  wrapTunnel( p, width );
}

// Orden de exploracion: direccion actual, giros y por ultimo la inversa.
function neighborDirs( currentDir ) {
  const opposite = OPPOSITE[ currentDir ];
  const order = [];
  if ( currentDir ) order.push( currentDir );
  for ( const dir of Object.keys( DIRS ) ) {
    if ( dir !== currentDir && dir !== opposite ) order.push( dir );
  }
  if ( opposite && opposite !== currentDir ) order.push( opposite );
  return order;
}

// Celda vecina transitable para un fantasma (puerta 3 y tunel incluidos).
function ghostStepCell( grid, x, y, dir ) {
  if ( !canMove( grid, x, y, dir, 'ghost' ) ) return null;
  const d = DIRS[ dir ];
  const width = grid[ 0 ].length;
  let nx = x + d.x;
  const ny = y + d.y;
  if ( ny === TUNNEL_ROW && ( nx < 0 || nx >= width ) ) nx = ( nx + width ) % width;
  return { x: nx, y: ny };
}

function fallbackDir( grid, x, y, preferred ) {
  if ( preferred && canMove( grid, x, y, preferred, 'ghost' ) ) return preferred;
  return Object.keys( DIRS ).find( ( dir ) => canMove( grid, x, y, dir, 'ghost' ) ) || preferred;
}

// Primer paso de un camino minimo hasta 'to'. Si el objetivo es inalcanzable
// (pared), se dirige a la celda alcanzable mas cercana.
function shortestPathStep( grid, from, to, currentDir ) {
  const H = grid.length;
  const W = grid[ 0 ].length;
  const clampX = ( v ) => Math.max( 0, Math.min( W - 1, Math.round( v ) ) );
  const clampY = ( v ) => Math.max( 0, Math.min( H - 1, Math.round( v ) ) );
  const sx = clampX( from.x );
  const sy = clampY( from.y );
  const gx = clampX( to.x );
  const gy = clampY( to.y );
  const startKey = sy * W + sx;
  const goalKey = gy * W + gx;
  const order = neighborDirs( currentDir );
  const fallback = () => fallbackDir( grid, sx, sy, currentDir );

  if ( startKey === goalKey ) return fallback();

  const depth = new Map( [ [ startKey, 0 ] ] );
  const prev = new Map();
  const queue = [ startKey ];
  let head = 0;
  while ( head < queue.length ) {
    const key = queue[ head++ ];
    const x = key % W;
    const y = Math.floor( key / W );
    const nextDepth = depth.get( key ) + 1;
    for ( const dir of order ) {
      const cell = ghostStepCell( grid, x, y, dir );
      if ( !cell ) continue;
      const nk = cell.y * W + cell.x;
      if ( depth.has( nk ) ) continue;
      depth.set( nk, nextDepth );
      prev.set( nk, { key, dir } );
      queue.push( nk );
    }
  }

  // Distancias desde el objetivo; si cae en una pared, desde sus vecinos libres.
  const sources = [];
  if ( !isWall( grid, gx, gy, 'ghost' ) ) {
    sources.push( goalKey );
  } else {
    for ( const dir of Object.keys( DIRS ) ) {
      const cell = ghostStepCell( grid, gx, gy, dir );
      if ( cell ) sources.push( cell.y * W + cell.x );
    }
  }
  if ( !sources.length ) return fallback();

  const goalDist = new Map();
  const goalQueue = [];
  for ( const key of sources ) {
    if ( goalDist.has( key ) ) continue;
    goalDist.set( key, 0 );
    goalQueue.push( key );
  }
  let goalHead = 0;
  while ( goalHead < goalQueue.length ) {
    const key = goalQueue[ goalHead++ ];
    const x = key % W;
    const y = Math.floor( key / W );
    const nextDist = goalDist.get( key ) + 1;
    for ( const dir of Object.keys( DIRS ) ) {
      const cell = ghostStepCell( grid, x, y, dir );
      if ( !cell ) continue;
      const nk = cell.y * W + cell.x;
      if ( goalDist.has( nk ) ) continue;
      goalDist.set( nk, nextDist );
      goalQueue.push( nk );
    }
  }

  let bestKey = null;
  let bestGoalDist = Infinity;
  let bestDepth = Infinity;
  for ( const [ key, d ] of depth ) {
    const gd = goalDist.get( key );
    if ( gd === undefined ) continue;
    if ( gd < bestGoalDist || ( gd === bestGoalDist && d < bestDepth ) ) {
      bestGoalDist = gd;
      bestDepth = d;
      bestKey = key;
    }
  }
  if ( bestKey === null || bestKey === startKey ) return fallback();

  while ( prev.get( bestKey ).key !== startKey ) bestKey = prev.get( bestKey ).key;
  return prev.get( bestKey ).dir;
}

// Objetivo de cada fantasma, acotado siempre al rango valido del laberinto.
function ghostTarget( game, g ) {
  const grid = game.grid;
  const H = grid.length;
  const W = grid[ 0 ].length;
  const p = game.pacman;
  const px = Math.round( p.x );
  const py = Math.round( p.y );
  const pd = DIRS[ p.dir ] || DIRS.left;
  let tx;
  let ty;

  if ( g.kind === 'pinky' ) {
    tx = px + pd.x * 4;
    ty = py + pd.y * 4;
  } else if ( g.kind === 'inky' ) {
    const ax = px + pd.x * 2;
    const ay = py + pd.y * 2;
    const blinky = game.ghosts.find( ( other ) => other.kind === 'blinky' ) || p;
    tx = 2 * ax - Math.round( blinky.x );
    ty = 2 * ay - Math.round( blinky.y );
  } else if ( g.kind === 'clyde' ) {
    const dx = px - Math.round( g.x );
    const dy = py - Math.round( g.y );
    const near = Math.sqrt( dx * dx + dy * dy ) <= 8;
    tx = near ? 1 : px;
    ty = near ? H - 2 : py;
  } else {
    tx = px;
    ty = py;
  }

  return {
    x: Math.max( 0, Math.min( W - 1, Math.round( tx ) ) ),
    y: Math.max( 0, Math.min( H - 1, Math.round( ty ) ) ),
  };
}

function decideGhost( game, g ) {
  g.dir = shortestPathStep( game.grid, g, ghostTarget( game, g ), g.dir );
}

function moveGhost( game, g ) {
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );
    decideGhost( game, g );
    if ( !canMove( grid, g.x, g.y, g.dir, 'ghost' ) ) return;
  }

  const d = DIRS[ g.dir ];
  g.x += d.x * g.speed;
  g.y += d.y * g.speed;
  wrapTunnel( g, width );
}

function resetPositions( game ) {
  const p = game.pacman;
  p.x = PACMAN_START.x;
  p.y = PACMAN_START.y;
  p.dir = 'left';
  p.nextDir = null;
  game.ghosts.forEach( ( g, i ) => {
    g.x = GHOST_STARTS[ i ].x;
    g.y = GHOST_STARTS[ i ].y;
    g.dir = 'up';
  } );
}

function collides( a, b ) {
  return Math.abs( a.x - b.x ) < 0.5 && Math.abs( a.y - b.y ) < 0.5;
}

function update( game ) {
  movePacman( game );
  game.ghosts.forEach( ( g ) => moveGhost( game, g ) );

  for ( const g of game.ghosts ) {
    if ( collides( game.pacman, g ) ) {
      game.lives--;
      if ( game.lives <= 0 ) {
        game.state = 'lost';
        return;
      }
      resetPositions( game );
      break;
    }
  }

  if ( game.dotsRemaining <= 0 ) game.state = 'won';
}

window.createGame = createGame;
window.update = update;
window.DIRS = DIRS;
window.shortestPathStep = shortestPathStep;
window.ghostTarget = ghostTarget;
