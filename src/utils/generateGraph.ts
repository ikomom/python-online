import type { GraphData, GraphEdge, GraphNode } from "../types";

export const GRAPH_COLS = 25;
export const GRAPH_ROWS = 20;

const SVG_W = 640;
const SVG_H = 520;
const PAD = 32;
const CELL_W = (SVG_W - PAD * 2) / (GRAPH_COLS - 1);
const CELL_H = (SVG_H - PAD * 2) / (GRAPH_ROWS - 1);

function makeLCG(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

const isOuter = (r: number, c: number) =>
  r === 0 || r === GRAPH_ROWS - 1 || c === 0 || c === GRAPH_COLS - 1;

const isCongested = (r: number, c: number) =>
  r >= 7 && r <= 13 && c >= 7 && c <= 17 &&
  !(r === 10 || c === 10 || c === 14);

const isExpress = (r: number, c: number) =>
  r === 4 || r === 10 || r === 16 || c === 5 || c === 12 || c === 20;

const isCross = (r: number, c: number) =>
  r === 7 || r === 13 || c === 8 || c === 17;

function getWeight(rng: () => number, r1: number, c1: number, r2: number, c2: number): number {
  if (isCongested(r1, c1) || isCongested(r2, c2)) return Math.floor(rng() * 9) + 10;
  if (isOuter(r1, c1) && isOuter(r2, c2)) return Math.floor(rng() * 2) + 1;
  if ((isExpress(r1, c1) && isExpress(r2, c2)) || (isCross(r1, c1) && isCross(r2, c2)))
    return Math.floor(rng() * 3) + 2;
  return Math.floor(rng() * 5) + 5;
}

function getProb(r1: number, c1: number, r2: number, c2: number): number {
  if (isOuter(r1, c1) && isOuter(r2, c2)) return 1.0;
  if (isCongested(r1, c1) || isCongested(r2, c2)) return 0.55;
  if (isExpress(r1, c1) || isExpress(r2, c2)) return 0.92;
  if (isCross(r1, c1) || isCross(r2, c2)) return 0.88;
  return 0.55;
}

let _cached: GraphData | null = null;

export function generateGraph(): GraphData {
  if (_cached) return _cached;

  const rng = makeLCG(0xdeadbeef);

  const nodes: GraphNode[] = [];
  for (let r = 0; r < GRAPH_ROWS; r++) {
    for (let c = 0; c < GRAPH_COLS; c++) {
      const id = String(r * GRAPH_COLS + c);
      nodes.push({
        id, label: id,
        x: Math.round(PAD + c * CELL_W),
        y: Math.round(PAD + r * CELL_H),
      });
    }
  }

  const edges: GraphEdge[] = [];
  const edgeSet = new Set<string>();
  const adjSet = new Map<string, Set<string>>();
  for (const n of nodes) adjSet.set(n.id, new Set());

  const addEdge = (a: string, b: string, w?: number) => {
    if (a === b) return;
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (edgeSet.has(key)) return;
    edgeSet.add(key);
    const ra = Math.floor(Number(a) / GRAPH_COLS), ca = Number(a) % GRAPH_COLS;
    const rb = Math.floor(Number(b) / GRAPH_COLS), cb = Number(b) % GRAPH_COLS;
    const weight = w ?? getWeight(rng, ra, ca, rb, cb);
    edges.push({ from: a, to: b, weight });
    adjSet.get(a)!.add(b);
    adjSet.get(b)!.add(a);
  };

  const idx = (r: number, c: number) => String(r * GRAPH_COLS + c);

  for (let r = 0; r < GRAPH_ROWS; r++)
    for (let c = 0; c < GRAPH_COLS - 1; c++)
      if (rng() < getProb(r, c, r, c + 1)) addEdge(idx(r, c), idx(r, c + 1));

  for (let r = 0; r < GRAPH_ROWS - 1; r++)
    for (let c = 0; c < GRAPH_COLS; c++)
      if (rng() < getProb(r, c, r + 1, c)) addEdge(idx(r, c), idx(r + 1, c));

  // Outer ring skip connections
  for (let c = 0; c < GRAPH_COLS - 2; c++) {
    addEdge(idx(0, c), idx(0, c + 2), Math.floor(rng() * 2) + 2);
    addEdge(idx(GRAPH_ROWS - 1, c), idx(GRAPH_ROWS - 1, c + 2), Math.floor(rng() * 2) + 2);
  }
  for (let r = 0; r < GRAPH_ROWS - 2; r++) {
    addEdge(idx(r, 0), idx(r + 2, 0), Math.floor(rng() * 2) + 2);
    addEdge(idx(r, GRAPH_COLS - 1), idx(r + 2, GRAPH_COLS - 1), Math.floor(rng() * 2) + 2);
  }

  // Express lane skip connections
  for (const er of [4, 10, 16])
    for (let c = 0; c < GRAPH_COLS - 2; c++)
      addEdge(idx(er, c), idx(er, c + 2), Math.floor(rng() * 2) + 1);
  for (const ec of [5, 12, 20])
    for (let r = 0; r < GRAPH_ROWS - 2; r++)
      addEdge(idx(r, ec), idx(r + 2, ec), Math.floor(rng() * 2) + 1);

  // Connectivity fix
  const visited = new Set<string>();
  const queue = [nodes[0].id];
  visited.add(nodes[0].id);
  while (queue.length) {
    const u = queue.shift()!;
    for (const v of adjSet.get(u) ?? []) {
      if (!visited.has(v)) { visited.add(v); queue.push(v); }
    }
  }
  for (const n of nodes) {
    if (visited.has(n.id)) continue;
    const r = Math.floor(Number(n.id) / GRAPH_COLS);
    const c = Number(n.id) % GRAPH_COLS;
    const neighbors = [
      r > 0 ? idx(r - 1, c) : null,
      r < GRAPH_ROWS - 1 ? idx(r + 1, c) : null,
      c > 0 ? idx(r, c - 1) : null,
      c < GRAPH_COLS - 1 ? idx(r, c + 1) : null,
    ].filter(Boolean) as string[];
    const target = neighbors.find((nb) => visited.has(nb)) ?? neighbors[0];
    if (target) {
      addEdge(n.id, target);
      visited.add(n.id);
      const q2 = [n.id];
      while (q2.length) {
        const u2 = q2.shift()!;
        for (const v of adjSet.get(u2) ?? []) {
          if (!visited.has(v)) { visited.add(v); q2.push(v); }
        }
      }
    }
  }

  _cached = { nodes, edges, start: "0", end: String(GRAPH_ROWS * GRAPH_COLS - 1) };
  return _cached;
}
