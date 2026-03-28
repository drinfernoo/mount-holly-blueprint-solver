'use strict';

const fs = require('fs');
const path = require('path');

function normalizeColor(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim().toLowerCase();
  return s || null;
}

function ensureSlotSync(map) {
  if (!map.nodes || typeof map.nodes !== 'object') map.nodes = {};
  if (!map.lanternSlots || typeof map.lanternSlots !== 'object') map.lanternSlots = {};

  // Ensure every lantern node has a slot entry
  for (const [nodeId, node] of Object.entries(map.nodes)) {
    if (!node || typeof node !== 'object') continue;
    if (node.kind !== 'lantern' && !String(nodeId).startsWith('g(')) continue;

    const color = normalizeColor(node.lantern || null);
    const slot = map.lanternSlots[nodeId] || {
      id: nodeId,
      ref: nodeId,
      color: null,
      active: true,
      sides: Array.isArray(node.sides) ? node.sides.slice() : [],
    };

    if (color) slot.color = color;
    slot.active = node.active !== false;
    if (!slot.ref) slot.ref = nodeId;

    map.lanternSlots[nodeId] = slot;

    node.lantern = slot.color || null;
    node.lanternRef = slot.ref || nodeId;
    node.active = slot.active !== false;
  }

  // Ensure slot state is reflected to node
  for (const [slotId, slotRaw] of Object.entries(map.lanternSlots)) {
    const slot = slotRaw && typeof slotRaw === 'object' ? slotRaw : { id: slotId };
    const node = map.nodes[slotId];
    if (!node) continue;

    node.lantern = normalizeColor(slot.color || null);
    node.lanternRef = slot.ref || slotId;
    node.active = slot.active !== false;
  }
}

function filterKnownPaths(map) {
  if (!map.knownPaths || typeof map.knownPaths !== 'object') {
    map.knownPaths = {};
    return;
  }

  const valid = {};
  for (const [key, pathDefRaw] of Object.entries(map.knownPaths)) {
    const pathDef = pathDefRaw && typeof pathDefRaw === 'object' ? pathDefRaw : null;
    if (!pathDef || !Array.isArray(pathDef.nodes) || pathDef.nodes.length === 0) continue;

    const allExist = pathDef.nodes.every((n) => !!map.nodes[n]);
    if (!allExist) continue;

    valid[key] = pathDef;
  }

  map.knownPaths = valid;
}

function populateKnownPaths(map) {
  if (!map || typeof map !== 'object') {
    throw new Error('map object required');
  }

  ensureSlotSync(map);
  filterKnownPaths(map);

  if (!Array.isArray(map.notes)) map.notes = [];
  const note = 'Known paths and lantern-slot sync verified.';
  if (!map.notes.includes(note)) map.notes.push(note);

  return map;
}

function main() {
  const inputPath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(__dirname, 'data', 'map.default.json');

  const outputPath = process.argv[3]
    ? path.resolve(process.argv[3])
    : inputPath;

  const map = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  populateKnownPaths(map);
  fs.writeFileSync(outputPath, `${JSON.stringify(map, null, 2)}\n`, 'utf8');

  // eslint-disable-next-line no-console
  console.log(`Synchronized known paths/slots in: ${outputPath}`);
}

if (require.main === module) {
  main();
}

module.exports = {
  populateKnownPaths,
};
