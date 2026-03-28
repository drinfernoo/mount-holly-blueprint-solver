'use strict';

const fs = require('fs');
const path = require('path');
const { canonicalBetweenRooms, outerGapId } = require('./build-graph-map');

function normalizeColor(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim().toLowerCase();
  return s || null;
}

function parseRoomId(id) {
  const m = String(id || '').trim().toUpperCase().match(/^([A-Z]+)(-?\d+)$/);
  if (!m) return null;
  return `${m[1]}${Number(m[2])}`;
}

function parseGapToken(inner, files) {
  const s = String(inner || '').trim();

  // g(A1-B1)
  let m = s.match(/^([A-Z]+-?\d+)\s*-\s*([A-Z]+-?\d+)$/i);
  if (m) {
    const a = parseRoomId(m[1]);
    const b = parseRoomId(m[2]);
    if (!a || !b) return null;
    return canonicalBetweenRooms(a, b, files);
  }

  // g(E2>)
  m = s.match(/^([A-Z]+-?\d+)\s*([><\^v])$/i);
  if (m) {
    const room = parseRoomId(m[1]);
    if (!room) return null;
    const sym = m[2];
    const dir = sym === '>' ? 'E' : sym === '<' ? 'W' : sym === '^' ? 'N' : 'S';
    return outerGapId(room, dir);
  }

  // g(<A7)
  m = s.match(/^([><\^v])\s*([A-Z]+-?\d+)$/i);
  if (m) {
    const room = parseRoomId(m[2]);
    if (!room) return null;
    const sym = m[1];
    const dir = sym === '>' ? 'E' : sym === '<' ? 'W' : sym === '^' ? 'N' : 'S';
    return outerGapId(room, dir);
  }

  return null;
}

function notationToNodeSequence(map, notation) {
  const files = Array.isArray(map.coordinateSystem?.files)
    ? map.coordinateSystem.files.map((x) => String(x).trim().toUpperCase())
    : ['A', 'B', 'C', 'D', 'E'];

  const parts = String(notation || '')
    .split(/\s*->\s*/)
    .map((x) => x.trim())
    .filter(Boolean);

  const nodes = [];

  for (const part of parts) {
    let m = part.match(/^start\(([^)]+)\)$/i);
    if (m) {
      const room = parseRoomId(m[1]);
      if (room) nodes.push(room);
      continue;
    }

    m = part.match(/^r\(([^)]+)\)$/i);
    if (m) {
      const room = parseRoomId(m[1]);
      if (room) nodes.push(room);
      continue;
    }

    m = part.match(/^g\(([^)]+)\)$/i);
    if (m) {
      const gap = parseGapToken(m[1], files);
      if (gap) nodes.push(gap);
      continue;
    }

    const room = parseRoomId(part);
    if (room) nodes.push(room);
  }

  // compact repeats
  const compact = [];
  for (const n of nodes) {
    if (!compact.length || compact[compact.length - 1] !== n) compact.push(n);
  }

  return compact;
}

function applyNotationPath(map, pathId, color, notation, name = null) {
  if (!map || typeof map !== 'object' || !map.nodes || typeof map.nodes !== 'object') {
    throw new Error('Map must include nodes');
  }

  if (!map.lanternSlots || typeof map.lanternSlots !== 'object') {
    map.lanternSlots = {};
  }

  const nodes = notationToNodeSequence(map, notation);
  const c = normalizeColor(color);

  for (const nodeId of nodes) {
    if (!nodeId || !String(nodeId).startsWith('g(')) continue;

    const node = map.nodes[nodeId];
    if (!node) continue;

    if (c) {
      node.lantern = c;
      node.lanternRef = nodeId;
      node.active = true;

      const slot = map.lanternSlots[nodeId] || { id: nodeId, ref: nodeId, color: null, active: true, sides: [] };
      slot.color = c;
      slot.active = true;
      map.lanternSlots[nodeId] = slot;
    }
  }

  if (!map.knownPaths || typeof map.knownPaths !== 'object') map.knownPaths = {};

  map.knownPaths[pathId] = {
    id: pathId,
    name: name || pathId,
    color: c,
    notation,
    startId: nodes[0] || null,
    endId: nodes[nodes.length - 1] || null,
    nodes,
  };

  return map.knownPaths[pathId];
}

function main() {
  const inputPath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(__dirname, 'data', 'map.default.json');

  const outputPath = process.argv[3]
    ? path.resolve(process.argv[3])
    : inputPath;

  const pathId = process.argv[4] || 'redOnly';
  const color = process.argv[5] || 'red';
  const notation = process.argv.slice(6).join(' ');

  if (!notation) {
    throw new Error('notation string required (use start()/g()/r() with ->)');
  }

  const map = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const out = applyNotationPath(map, pathId, color, notation, `Known ${color} path`);
  fs.writeFileSync(outputPath, `${JSON.stringify(map, null, 2)}\n`, 'utf8');

  // eslint-disable-next-line no-console
  console.log(`Applied notation path ${pathId} with ${out.nodes.length} nodes to ${outputPath}`);
}

if (require.main === module) {
  main();
}

module.exports = {
  applyNotationPath,
  notationToNodeSequence,
};
