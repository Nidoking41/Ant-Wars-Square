import { HexCoord } from '../hexUtils';

// Custom map layouts for campaign levels and Scrimmage maps, authored as ASCII.
//
// ANT WARS SQUARE: there are two kinds of art.
//  - Square art (Scrimmage maps): one character per tile, written side by
//    side with no spaces between them. Row = r, column = q.
//  - Hex art (campaign levels, still from the hex game): described below,
//    and turned into squares by squareRow() / squareConnectors().
// The legend is the same for both. On square maps the cliff ramp is one of
// '^' north, 'v' south, '<' west, '>' east.
//
// The board is flat-top: q is the column and each step in q moves right and
// half a row DOWN; r moves straight down. So layouts use "double-height"
// coordinates: a character grid where cell (x, y) is a hex only when x + y is
// even, and
//     q = x
//     r = (y - x) / 2
// Each text row is half a hex tall, which means the art on the page matches
// the map on screen. Neighbours of a cell are (x±1, y±1) and (x, y±2).
//
// Legend:
//   '.'  open hex          ' ' void (not part of the map)
//   '~'  water: drawn as a blue hex but NOT part of the map - nothing can
//        enter it, stand on it, or be placed on it
//   'T'  tree              'F' food node       'M' mineral node
//   '@'  Honeypot: a food node that never runs out
//   '*'  Mine: a mineral node that never runs out
//   'G'  goal hex: open ground an escort objective must reach
//   'W'  enemy watch-nest: a finished enemy anthill on a mineral node
//   '%'  fungus-covered ground: open, just drawn pale and rotten
//   cliff: raised ground with a rock face on three sides. An ant can only
//        climb on or off through the other three sides (the ramp), and one
//        standing on top sees 1 hex further. The character names the side
//        the ramp faces:  '^' north   'v' south
//                         '{' north-west   '}' north-east
//                         '[' south-west   ']' south-east
//   'Z'  Sorlorg's fungus garden: a tough enemy anthill (id camp_player2_garden)
//   'P'  wave spawn point: open ground where enemy.waves can arrive (numbered
//        0, 1, 2... in reading order, top row first; a wave picks one with `at`)
//   '1'  player leader     '2' enemy leader
//   a-z  player unit marker, A-Z enemy unit marker - resolved via the level's
//        `legend: { a: 'scout', A: 'soldier' }`
// Any other character is an error, and so is a non-space character on an
// off-grid cell (x + y odd) - that catches art that has slipped a column.

const OPEN = '.';
const VOID = ' ';
const WATER = '~';
// Cliff characters -> the ramp's direction, as an index into getNeighbors'
// order (0 east, 1 north, 2 west, 3 south). The hex art's slanted sides
// become east or west on squares; '<' and '>' can also be used.
export const CLIFF_CHARS = { ']': 0, '}': 0, '>': 0, '^': 1, '{': 2, '[': 2, '<': 2, 'v': 3 };

// ANT WARS SQUARE: the layouts are still drawn as hex art (see above), and
// each hex becomes one square tile:
//     q = x            (the column stays the column)
//     r = y / 2        (rounded down on the right half, up on the left half,
//                       so a map that is the same turned half a turn stays so)
// Two hexes that touched can end up only touching at a corner; squares only
// connect through their sides, so squareConnectors() then fills in the
// corner gap with open ground. That keeps every path of the hex map open.
function squareRow(xx, yy) {
  return xx >= 0 ? Math.floor(yy / 2) : Math.ceil(yy / 2);
}

// Hex neighbours in the double-height art grid (each pair listed once)
const ART_NEIGHBORS = [[1, 1], [1, -1], [0, 2]];

export function parseLayout(rows, legend = {}) {
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('layout: rows must be a non-empty array');

  // Read every cell first, in raw (x, y).
  const cells = [];
  rows.forEach((row, y) => {
    if (row.includes('\t')) throw new Error(`layout: tab character in row ${y}; use spaces`);
    [...row].forEach((ch, x) => {
      if (ch !== VOID) cells.push({ ch, x, y });
    });
  });
  if (cells.length === 0) throw new Error('layout: no hexes');

  // Square art (one character per tile, side by side) or the old hex art
  // (cells on a checkerboard)? Hex art is converted, see squareRow().
  const parity = (cells[0].x + cells[0].y) % 2;
  const hexArt = cells.every(c => (c.x + c.y) % 2 === parity);

  // Recentre so the map sits around (0, 0).
  const xs = cells.map(c => c.x), ys = cells.map(c => c.y);
  let dx, dy;
  if (hexArt) {
    // The y shift absorbs the parity so that x + y is even afterwards
    const even = n => n - (n % 2);
    dx = even(Math.round((Math.min(...xs) + Math.max(...xs)) / 2));
    dy = even(Math.round((Math.min(...ys) + Math.max(...ys)) / 2)) + parity;
  } else {
    dx = Math.floor((Math.min(...xs) + Math.max(...xs)) / 2);
    dy = Math.floor((Math.min(...ys) + Math.max(...ys)) / 2);
  }

  const hexes = {};
  const mapHexes = [];
  const water = [];
  const resources = [];
  const trees = [];
  const leaders = {};
  const units = [];
  const goals = [];
  const watchNests = [];
  const spawns = [];
  const gardens = [];
  const fungus = [];
  const cliffs = {};
  let gridRadius = 0;

  cells.forEach(({ ch, x, y }) => {
    const xx = x - dx, yy = y - dy;
    const q = xx;
    const r = hexArt ? squareRow(xx, yy) : yy;
    const pos = new HexCoord(q, r);
    const key = `${q},${r}`;
    if (hexes[key]) throw new Error(`layout: duplicate hex at ${key}`);
    gridRadius = Math.max(gridRadius, Math.abs(q), Math.abs(r));

    // Water is drawn but is not a playable hex: it stays out of the mask.
    if (ch === WATER) { water.push(pos); return; }

    hexes[key] = true;
    mapHexes.push(pos);

    if (ch === OPEN) return;
    if (ch === '%') { fungus.push(pos); return; }
    if (ch in CLIFF_CHARS) { cliffs[key] = CLIFF_CHARS[ch]; return; }
    if (ch === 'G') { goals.push(pos); return; }
    if (ch === 'P') { spawns.push({ pos, x, y }); return; }
    if (ch === 'Z') { resources.push({ type: 'food', position: pos }); gardens.push(pos); return; }
    if (ch === 'T') { trees.push(pos); return; }
    if (ch === 'F') { resources.push({ type: 'food', position: pos }); return; }
    if (ch === 'M') { resources.push({ type: 'minerals', position: pos }); return; }
    if (ch === '@') { resources.push({ type: 'food', position: pos, permanent: true }); return; }
    if (ch === '*') { resources.push({ type: 'minerals', position: pos, permanent: true }); return; }
    if (ch === 'W') { resources.push({ type: 'minerals', position: pos }); watchNests.push(pos); return; }
    if (ch === '1' || ch === '2') {
      const side = ch === '1' ? 'player1' : 'player2';
      if (leaders[side]) throw new Error(`layout: more than one '${ch}' leader marker`);
      leaders[side] = pos;
      return;
    }
    if (/[a-zA-Z]/.test(ch)) {
      const type = legend[ch];
      if (!type) throw new Error(`layout: unit marker '${ch}' has no entry in legend`);
      units.push({ owner: ch === ch.toLowerCase() ? 'player1' : 'player2', type, position: pos, marker: ch });
      return;
    }
    throw new Error(`layout: unknown character '${ch}' at column ${x}, row ${y}`);
  });

  if (!leaders.player1) throw new Error("layout: missing player leader marker '1'");

  if (hexArt) squareConnectors(cells, dx, dy, hexes, mapHexes, water);

  return {
    // cliffs ride on the map shape, which every movement check already gets
    mapShape: Object.keys(cliffs).length ? { type: 'custom', hexes, cliffs } : { type: 'custom', hexes },
    mapHexes,
    water,
    gridRadius,
    resources,
    trees,
    leaders,
    units,
    goals,
    watchNests,
    gardens,
    fungus,
    // reading order: top row first, then left to right
    spawns: spawns.sort((a, b) => (a.y - b.y) || (a.x - b.x)).map(s => s.pos)
  };
}

// Fill corner gaps (see squareRow). For two land hexes that touched but whose
// squares only meet at a corner, one of the two squares beside both is made
// open ground - the one nearer the middle of the map (both on a tie), unless
// one of them is already land. Water squares are never used.
function squareConnectors(cells, dx, dy, hexes, mapHexes, water) {
  const land = new Map();
  cells.forEach(({ ch, x, y }) => { if (ch !== WATER) land.set(`${x - dx},${y - dy}`, true); });
  const wet = new Set(water.map(w => `${w.q},${w.r}`));
  const added = [];
  land.forEach((_, k) => {
    const [ax, ay] = k.split(',').map(Number);
    ART_NEIGHBORS.forEach(([ox, oy]) => {
      const bx = ax + ox, by = ay + oy;
      if (!land.has(`${bx},${by}`)) return;
      const a = { q: ax, r: squareRow(ax, ay) };
      const b = { q: bx, r: squareRow(bx, by) };
      if (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) <= 1) return;
      const options = [{ q: a.q, r: b.r }, { q: b.q, r: a.r }];
      if (options.some(o => hexes[`${o.q},${o.r}`])) return;
      const dry = options.filter(o => !wet.has(`${o.q},${o.r}`));
      if (dry.length === 0) return;
      const far = o => Math.abs(o.q) + Math.abs(o.r);
      const best = Math.min(...dry.map(far));
      dry.filter(o => far(o) === best).forEach(o => added.push(o));
    });
  });
  added.forEach(({ q, r }) => {
    const key = `${q},${r}`;
    if (hexes[key]) return;
    hexes[key] = true;
    mapHexes.push(new HexCoord(q, r));
  });
}

/** True when `hex` is inside a parsed layout's mask. */
export function inLayout(layout, hex) {
  return layout.mapShape.hexes[`${hex.q},${hex.r}`] === true;
}
