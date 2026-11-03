// Hexagonal grid utilities using axial coordinates

export class HexCoord {
  constructor(q, r) {
    this.q = q; // column
    this.r = r; // row
  }

  toString() {
    return `${this.q},${this.r}`;
  }

  static fromString(str) {
    const [q, r] = str.split(',').map(Number);
    return new HexCoord(q, r);
  }

  equals(other) {
    return this.q === other.q && this.r === other.r;
  }
}

// ANT WARS SQUARE: the board is made of square tiles. The coordinate names
// are kept from the hex game so the rest of the code works unchanged:
//   q = column (grows to the right), r = row (grows downward).
// Units move and attack in 4 directions only (no diagonals), so the distance
// between two tiles is the number of straight steps between them
// (|dq| + |dr|), and a range is a diamond shape.

// The 4 neighbours of a tile, in a fixed order: east, north, west, south.
// (Cliff ramp directions use these same index numbers.)
export const SQUARE_DIRECTIONS = [
  { q: 1, r: 0 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: 0, r: 1 }
];

export function getNeighbors(hex) {
  return SQUARE_DIRECTIONS.map(dir => new HexCoord(hex.q + dir.q, hex.r + dir.r));
}

// Number of straight steps between two tiles
export function hexDistance(a, b) {
  return Math.abs(a.q - b.q) + Math.abs(a.r - b.r);
}

// Every tile within `range` steps (a diamond), including the centre
export function hexesInRange(center, range) {
  const results = [];
  for (let q = -range; q <= range; q++) {
    const rest = range - Math.abs(q);
    for (let r = -rest; r <= rest; r++) {
      results.push(new HexCoord(center.q + q, center.r + r));
    }
  }
  return results;
}

// Width of one square tile in pixels for a given "hexSize". Matches the
// height of the old hex tiles, so every sprite keeps its size.
export const tileSize = hexSize => Math.round(Math.sqrt(3) * hexSize);

// Centre of a tile in pixels
export function hexToPixel(hex, hexSize) {
  const t = tileSize(hexSize);
  return { x: t * hex.q, y: t * hex.r };
}

// Tile under a pixel position
export function pixelToHex(x, y, hexSize) {
  const t = tileSize(hexSize);
  return new HexCoord(Math.round(x / t), Math.round(y / t));
}

// SVG polygon points for the square tile centred at (x, y), shrunk by `inset`
export function tilePoints(x, y, hexSize, inset = 0) {
  const h = tileSize(hexSize) / 2 - inset;
  return `${x + h},${y - h} ${x - h},${y - h} ${x - h},${y + h} ${x + h},${y + h}`;
}

// True if (q, r) is on the standard square board of this radius
export function inSquareBoard(hex, radius) {
  return Math.abs(hex.q) <= radius && Math.abs(hex.r) <= radius;
}

// ---- River (2-player 'river' maps) ----
// The river runs straight east-west along the middle row (r = 0), cutting
// the board into a north bank and a south bank. Three tiles are left as
// land crossings: the middle one and one toward each end. Water is not part
// of the board, so nothing can walk onto it, stand on it or be placed on it.
// Ranged attacks only look at distance, so they still reach across.

// The row (r) of the river in column q (always the middle row on squares).
export function getRiverRow(q) {
  return 0;
}

export function getRiverCrossingOffset(gridRadius) {
  return Math.max(2, Math.round(gridRadius * 2 / 3));
}

// True for every tile in the river's line, water and crossings alike.
export function isOnRiverLine(hex, gridRadius) {
  return Math.abs(hex.q) <= gridRadius && hex.r === getRiverRow(hex.q);
}

export function isRiverWater(hex, gridRadius) {
  if (!isOnRiverLine(hex, gridRadius)) return false;
  return hex.q !== 0 && Math.abs(hex.q) !== getRiverCrossingOffset(gridRadius);
}

// Which bank a tile is on. Tiles on the river line itself are on neither.
export function isNorthOfRiver(hex) {
  return hex.r < getRiverRow(hex.q);
}

export function isSouthOfRiver(hex) {
  return hex.r > getRiverRow(hex.q);
}

// Returns { water: HexCoord[], crossings: HexCoord[] } for a map radius.
export function getRiverLayout(gridRadius) {
  const water = [];
  const crossings = [];
  for (let q = -gridRadius; q <= gridRadius; q++) {
    const hex = new HexCoord(q, getRiverRow(q));
    (isRiverWater(hex, gridRadius) ? water : crossings).push(hex);
  }
  return { water, crossings };
}

// ---- Lake (small 2-player 'lake' maps) ----
// The 3x3 block in the middle of the board, minus its top-middle and
// bottom-middle tiles, which stay land. Units walk round either side.
export const LAKE_RADIUS = 1;

export function isLakeWater(hex) {
  if (hex.q === 0 && Math.abs(hex.r) === 1) return false; // top and bottom middle are land
  return Math.abs(hex.q) <= LAKE_RADIUS && Math.abs(hex.r) <= LAKE_RADIUS;
}

export function getLakeHexes() {
  const water = [];
  for (let q = -LAKE_RADIUS; q <= LAKE_RADIUS; q++) {
    for (let r = -LAKE_RADIUS; r <= LAKE_RADIUS; r++) {
      const hex = new HexCoord(q, r);
      if (isLakeWater(hex)) water.push(hex);
    }
  }
  return water;
}

// ---- Water in general (river or lake) ----
export function hasMapWater(mapShape) {
  return mapShape === 'river' || mapShape === 'lake';
}

export function isMapWater(hex, gridRadius, mapShape) {
  if (mapShape === 'river') return isRiverWater(hex, gridRadius);
  if (mapShape === 'lake') return isLakeWater(hex);
  return false;
}

export function getMapWaterHexes(gridRadius, mapShape) {
  if (mapShape === 'river') return getRiverLayout(gridRadius).water;
  if (mapShape === 'lake') return getLakeHexes();
  return [];
}

// ---- Cliffs (hand-drawn maps) ----
// mapShape.cliffs maps 'q,r' to the direction its ramp faces (an index into
// SQUARE_DIRECTIONS: 0 east, 1 north, 2 west, 3 south). The ramp side is the
// only way on or off; the other three sides are a sheer rock face.

export function cliffAt(hex, mapShape) {
  return mapShape?.cliffs?.[`${hex.q},${hex.r}`];
}

function directionIndex(from, to) {
  return SQUARE_DIRECTIONS.findIndex(d => to.q - from.q === d.q && to.r - from.r === d.r);
}

// True if a cliff face stands between two neighbouring tiles.
export function isCliffEdge(from, to, mapShape) {
  if (!mapShape?.cliffs) return false;
  const dir = directionIndex(from, to);
  if (dir < 0) return false;
  const a = cliffAt(from, mapShape);
  const b = cliffAt(to, mapShape);
  if (a !== undefined && a !== dir) return true;
  if (b !== undefined && b !== (dir + 2) % 4) return true;
  return false;
}

// True if someone standing at `viewer` looks at the cliff on `cliffHex`
// from the side of its rock face (so the wall hides its top). Uses the
// side(s) closest to the line of sight; looking straight along a diagonal
// counts as open if either of the two sides there is the ramp.
export function cliffFaceTowards(cliffHex, viewer, mapShape) {
  const ramp = cliffAt(cliffHex, mapShape);
  if (ramp === undefined) return false;
  const dq = viewer.q - cliffHex.q, dr = viewer.r - cliffHex.r;
  if (dq === 0 && dr === 0) return false;
  const sides = [];
  if (Math.abs(dq) >= Math.abs(dr)) sides.push(dq > 0 ? 0 : 2);
  if (Math.abs(dr) >= Math.abs(dq)) sides.push(dr < 0 ? 1 : 3);
  return !sides.includes(ramp);
}

// Check if a tile is on the board
export function isValidHex(hex, gridSize, mapShape = 'rectangle') {
  // Custom (campaign / hand-drawn) maps: mapShape carries the set of
  // playable tiles. Anything not in it is void.
  if (mapShape && typeof mapShape === 'object' && mapShape.type === 'custom') {
    return mapShape.hexes[`${hex.q},${hex.r}`] === true;
  }
  if (mapShape === 'river' || mapShape === 'lake') {
    return inSquareBoard(hex, gridSize) && !isMapWater(hex, gridSize, mapShape);
  }
  if (mapShape === 'square') {
    // 4-player rectangle
    return isValidSquareHex(hex, gridSize, Math.floor(gridSize * 0.75));
  }
  // 2- and 3-player square board
  return inSquareBoard(hex, gridSize);
}

// Get all valid hexes in movement range (with paths)
// Returns: { hex: HexCoord, path: HexCoord[] }[]
// blockedHexes: hexes you cannot path through (enemy units)
// cannotEndHexes: hexes you can path through but cannot end movement on (friendly units, eggs)
export function getMovementRangeWithPaths(startHex, range, gridSize, blockedHexes = [], cannotEndHexes = [], mapShape = 'rectangle') {
  const visited = new Set();
  const frontier = [[startHex, 0, []]]; // [hex, distance, path]
  visited.add(startHex.toString());

  const reachable = [];

  while (frontier.length > 0) {
    const [current, distance, path] = frontier.shift();

    // Only add to reachable if it's not a hex we cannot end on
    if (distance > 0 && !cannotEndHexes.some(blocked => blocked.equals(current))) {
      reachable.push({ hex: current, path: [...path, current] });
    }

    if (distance < range) {
      const neighbors = getNeighbors(current);
      for (const neighbor of neighbors) {
        const key = neighbor.toString();
        // Can path through cannotEndHexes, just can't pathfind through blockedHexes
        if (!visited.has(key) &&
            isValidHex(neighbor, gridSize, mapShape) &&
            !isCliffEdge(current, neighbor, mapShape) &&
            !blockedHexes.some(blocked => blocked.equals(neighbor))) {
          visited.add(key);
          frontier.push([neighbor, distance + 1, [...path, current]]);
        }
      }
    }
  }

  return reachable;
}

// Get all valid hexes in movement range (backwards compatible)
export function getMovementRange(startHex, range, gridSize, blockedHexes = [], mapShape = 'rectangle') {
  const withPaths = getMovementRangeWithPaths(startHex, range, gridSize, blockedHexes, [], mapShape);
  return withPaths.map(item => item.hex);
}

// Generate equilateral triangle grid (3-player map)
// sideLength: number of hexes per side (e.g., 15)
// Returns: array of HexCoord objects forming a triangle
export function generateTriangleGrid(sideLength) {
  const hexes = [];

  // Triangle with vertices at:
  // Top: (0, -(sideLength-1))
  // Bottom-right: (sideLength-1, 0)
  // Bottom-left: (-(sideLength-1), sideLength-1)

  for (let q = -(sideLength - 1); q <= (sideLength - 1); q++) {
    const r1 = Math.max(-(sideLength - 1), -q - (sideLength - 1));
    const r2 = Math.min(0, -q + (sideLength - 1));

    for (let r = r1; r <= r2; r++) {
      hexes.push(new HexCoord(q, r));
    }
  }

  return hexes;
}

// Generate a rectangular board (4-player map), width x height tiles
export function generateSquareGrid(width, height) {
  const hexes = [];
  const halfWidth = Math.floor(width / 2);
  const halfHeight = Math.floor(height / 2);
  for (let q = -halfWidth; q <= halfWidth; q++) {
    for (let r = -halfHeight; r <= halfHeight; r++) {
      hexes.push(new HexCoord(q, r));
    }
  }
  return hexes;
}

export function isValidSquareHex(hex, width, height) {
  return Math.abs(hex.q) <= Math.floor(width / 2) && Math.abs(hex.r) <= Math.floor(height / 2);
}

// Kept from the hex game (3-player maps are not used on squares)
export function rotateHex120(hex) {
  return new HexCoord(-hex.q - hex.r, hex.q);
}

// Rotate a tile 90 degrees clockwise around the centre
export function rotateHex90(hex) {
  return new HexCoord(-hex.r, hex.q);
}

// Get starting positions for players based on map shape
export function getPlayerStartingPositions(mapShape, sideLength, playerCount = 2) {
  if (mapShape === 'triangle' || (mapShape === 'rectangle' && playerCount === 3)) {
    // 3 players on a hexagon map at 2 o'clock, 6 o'clock, and 10 o'clock positions
    // Using the same hexagon grid as 2-player but with 3 spawn points
    // The hexagon has 6 sides, we place players at sides 2, 4, and 6 (counting clockwise from top)
    const radius = sideLength - 1;

    // In axial coordinates for a pointy-top hexagon:
    // Top vertex: (0, -radius)
    // Top-right edge center (2 o'clock): roughly (radius, -radius) direction
    // Right vertex: (radius, 0) - but we want the edge between top-right and bottom-right
    // Bottom-right edge center (4 o'clock): roughly (radius, radius/2) direction
    // Bottom vertex: (0, radius)
    // Bottom-left edge center (6 o'clock): roughly (-radius, radius) direction
    // Left vertex: (-radius, radius)
    // Top-left edge center (10 o'clock): roughly (-radius, 0) direction

    // For 120° rotational symmetry on a hexagon:
    // Position 1 (2 o'clock): edge between top and bottom-right - around (radius-1, -(radius-1)/2)
    // Position 2 (6 o'clock): bottom - (0, radius-1)
    // Position 3 (10 o'clock): edge between left and top - around (-(radius-1), 0)

    // Using proper 120° rotation points on hexagon edges:
    // Player 1: 2 o'clock position
    // Player 2: 6 o'clock position (bottom)
    // Player 3: 10 o'clock position

    // Calculate positions at 120° intervals
    // Start with one position and rotate by 120° twice
    const pos1 = new HexCoord(radius - 1, -(radius - 1));  // 2 o'clock (top-right area)
    const pos2 = new HexCoord(0, radius - 1);               // 6 o'clock (bottom)
    const pos3 = new HexCoord(-(radius - 1), 0);            // 10 o'clock (left)

    return [pos1, pos2, pos3];
  } else if (mapShape === 'square') {
    // 4 players at cardinal directions of the rectangular grid
    // width=sideLength, height=sideLength*0.75
    const width = sideLength;
    const height = Math.floor(sideLength * 0.75);
    const halfWidth = Math.floor(width / 2);
    const halfHeight = Math.floor(height / 2);

    // Convert offset positions to axial coordinates
    // Player positions in offset coords: top center, right center, bottom center, left center
    // Top: col=0, row=-halfHeight
    // Right: col=halfWidth, row=0
    // Bottom: col=0, row=halfHeight
    // Left: col=-halfWidth, row=0

    // Convert each offset position to axial
    const offsetToAxial = (col, row) => {
      return new HexCoord(col, row);
    };

    return [
      offsetToAxial(0, -halfHeight + 1),     // Player 1: Top (north) - 1 hex from edge
      offsetToAxial(halfWidth - 1, 0),       // Player 2: Right (east) - 1 hex from edge
      offsetToAxial(0, halfHeight - 1),      // Player 3: Bottom (south) - 1 hex from edge
      offsetToAxial(-halfWidth + 1, 0)       // Player 4: Left (west) - 1 hex from edge
    ];
  } else {
    // Rectangle (2-player)
    const radius = sideLength - 1;
    return [
      new HexCoord(0, radius),          // Player 1: South
      new HexCoord(0, -radius)          // Player 2: North
    ];
  }
}

// Mirror resources/trees with rotational symmetry
export function mirrorPositions(basePositions, playerCount) {
  if (playerCount === 2) {
    // 180° rotation for 2-player
    return basePositions.map(pos => new HexCoord(-pos.q, -pos.r));
  } else if (playerCount === 3) {
    // 120° rotations for 3-player
    const mirrored = [...basePositions];
    basePositions.forEach(pos => {
      const rotated1 = rotateHex120(pos);
      const rotated2 = rotateHex120(rotated1);
      mirrored.push(rotated1, rotated2);
    });
    return mirrored;
  } else if (playerCount === 4) {
    // 90° rotations for 4-player
    const mirrored = [...basePositions];
    basePositions.forEach(pos => {
      const rotated1 = rotateHex90(pos);
      const rotated2 = rotateHex90(rotated1);
      const rotated3 = rotateHex90(rotated2);
      mirrored.push(rotated1, rotated2, rotated3);
    });
    return mirrored;
  }
  return basePositions;
}
