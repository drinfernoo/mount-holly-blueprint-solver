'use strict';

const fs = require('fs');
const path = require('path');

const DIRS = ['N', 'E', 'S', 'W'];
const OPP = { N: 'S', E: 'W', S: 'N', W: 'E' };
const ROOM_OFF = {
  N: [0, 1],
  E: [1, 0],
  S: [0, -1],
  W: [-1, 0],
};

function normalizeColor(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim().toLowerCase();
  return s || null;
}

function parseRoomId(id) {
  const m = String(id || '').trim().toUpperCase().match(/^([A-Z]+)(-?\d+)$/);
  if (!m) return null;
  return { id: `${m[1]}${Number(m[2])}`, file: m[1], rank: Number(m[2]) };
}

function inferFiles(roomIds) {
  const out = [];
  for (const roomId of roomIds) {
    const p = parseRoomId(roomId);
    if (!p) continue;
    if (!out.includes(p.file)) out.push(p.file);
  }
  return out.sort();
}

function inferRanks(roomIds) {
  const out = [];
  for (const roomId of roomIds) {
    const p = parseRoomId(roomId);
    if (!p) continue;
    if (!out.includes(p.rank)) out.push(p.rank);
  }
  return out.sort((a, b) => a - b);
}

function roomShift(roomId, dir, files, rankSet) {
  const p = parseRoomId(roomId);
  if (!p) return null;

  let fi = files.indexOf(p.file);
  let rank = p.rank;
  if (fi < 0) return null;

  if (dir === 'N') rank += 1;
  if (dir === 'S') rank -= 1;
  if (dir === 'E') fi += 1;
  if (dir === 'W') fi -= 1;

  if (fi < 0 || fi >= files.length) return null;
  if (!rankSet.has(rank)) return null;

  return `${files[fi]}${rank}`;
}

function roomCoord(roomId, files) {
  const p = parseRoomId(roomId);
  if (!p) return null;
  const fi = files.indexOf(p.file);
  if (fi < 0) return null;

  // Rank 1 should map to the first room row above the bottom intersection row.
  const rIndex = p.rank - 1;

  return {
    x: 2 * fi + 1,
    y: 2 * rIndex + 1,
  };
}

function ensureNode(nodes, id, patch = {}) {
  if (!nodes[id]) nodes[id] = { id, neighbors: {} };
  Object.assign(nodes[id], patch);
  if (!nodes[id].neighbors) nodes[id].neighbors = {};
  return nodes[id];
}

function addNeighbor(neighborMap, dir, edgeValue) {
  const existing = neighborMap[dir];
  if (!existing) {
    neighborMap[dir] = edgeValue;
    return;
  }

  const arr = Array.isArray(existing) ? existing : [existing];
  const duplicate = arr.some((item) => {
    const toA = typeof item === 'string' ? item : item && item.to;
    const toB = typeof edgeValue === 'string' ? edgeValue : edgeValue && edgeValue.to;
    return !!toA && !!toB && toA === toB;
  });

  if (duplicate) return;

  arr.push(edgeValue);
  neighborMap[dir] = arr;
}

function firstLanternColor(rawValue) {
  if (rawValue === null || rawValue === undefined) return null;
  const list = Array.isArray(rawValue) ? rawValue : [rawValue];

  for (const item of list) {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const c = normalizeColor(item.color || item.lantern || item.value || null);
      if (c) return c;
      continue;
    }

    const c = normalizeColor(item);
    if (c) return c;
  }

  return null;
}

function getOpenDirs(room, defaultOpenAll) {
  if (Array.isArray(room.open)) {
    return room.open
      .map((d) => String(d).trim().toUpperCase())
      .filter((d) => DIRS.includes(d));
  }
  return defaultOpenAll ? DIRS.slice() : [];
}

function canonicalBetweenRooms(roomA, roomB, files) {
  const a = parseRoomId(roomA);
  const b = parseRoomId(roomB);
  if (!a || !b) return null;

  const afi = files.indexOf(a.file);
  const bfi = files.indexOf(b.file);

  const aKey = { fi: afi, rank: a.rank, id: a.id };
  const bKey = { fi: bfi, rank: b.rank, id: b.id };

  let first = aKey;
  let second = bKey;

  if (aKey.rank === bKey.rank) {
    if (aKey.fi > bKey.fi) {
      first = bKey;
      second = aKey;
    }
  } else if (aKey.fi === bKey.fi) {
    if (aKey.rank > bKey.rank) {
      first = bKey;
      second = aKey;
    }
  } else if (aKey.id > bKey.id) {
    first = bKey;
    second = aKey;
  }

  return `g(${first.id}-${second.id})`;
}

function outerGapId(roomId, dir) {
  if (dir === 'E') return `g(${roomId}>)`;
  if (dir === 'W') return `g(<${roomId})`;
  if (dir === 'N') return `g(^${roomId})`;
  return `g(v${roomId})`;
}

function dirFromDelta(dx, dy) {
  if (dx === 1 && dy === 0) return 'E';
  if (dx === -1 && dy === 0) return 'W';
  if (dx === 0 && dy === 1) return 'N';
  if (dx === 0 && dy === -1) return 'S';
  return null;
}

function convertRoomsToGraphMap(roomMap) {
  const rooms = roomMap.rooms || {};
  const includeRank0Rooms = roomMap.includeRank0Rooms === true;

  const roomIds = Object.keys(rooms).filter((id) => {
    const p = parseRoomId(id);
    if (!p) return false;
    if (includeRank0Rooms) return true;
    return p.rank >= 1;
  });

  if (!roomIds.length) {
    throw new Error('input map has no rooms');
  }

  const files = Array.isArray(roomMap.files)
    ? roomMap.files.map((x) => String(x).trim().toUpperCase()).filter(Boolean)
    : Array.isArray(roomMap.coordinateSystem?.files)
      ? roomMap.coordinateSystem.files.map((x) => String(x).trim().toUpperCase()).filter(Boolean)
      : inferFiles(roomIds);

  let ranks = Array.isArray(roomMap.ranks)
    ? roomMap.ranks.map((x) => Number(x)).filter(Number.isFinite)
    : inferRanks(roomIds);

  if (!includeRank0Rooms) {
    ranks = ranks.filter((r) => r >= 1);
  }

  const rankSet = new Set(ranks);
  const roomIdSet = new Set(roomIds);
  const defaultOpenAll = String(roomMap.defaultOpen || '').trim().toLowerCase() === 'all';

  const nodes = {};
  const sideToSlot = {};
  const gapById = {};

  // 1) Room nodes
  for (const roomId of roomIds) {
    const room = rooms[roomId] || {};
    const c = roomCoord(roomId, files);

    const roomName =
      typeof room.roomName === 'string' && room.roomName.trim()
        ? room.roomName.trim()
        : (typeof room.name === 'string' && room.name.trim() ? room.name.trim() : null);

    const roomColor =
      typeof room.roomColor === 'string' && room.roomColor.trim()
        ? room.roomColor.trim().toLowerCase()
        : null;

    ensureNode(nodes, roomId, {
      kind: 'room',
      roomId,
      letter: room.letter || null,
      roomName,
      name: roomName,
      roomColor,
      x: c ? c.x : null,
      y: c ? c.y : null,
      active: true,
    });
  }

  // 2) Collect all possible gap nodes and apply open/color from room sides
  for (const roomId of roomIds) {
    const room = rooms[roomId] || {};
    const roomNode = nodes[roomId];
    const openSet = new Set(getOpenDirs(room, defaultOpenAll));

    const sideLanterns = room.sideLanterns || room.edgeLanterns || room.lanterns || {};

    for (const dir of DIRS) {
      const sideKey = `${roomId}:${dir}`;
      const neighbor = roomShift(roomId, dir, files, rankSet);
      const hasNeighbor = !!(neighbor && roomIdSet.has(neighbor));

      const gapId = hasNeighbor
        ? canonicalBetweenRooms(roomId, neighbor, files)
        : outerGapId(roomId, dir);
      if (!gapId) continue;

      sideToSlot[sideKey] = gapId;

      const [dx, dy] = ROOM_OFF[dir];
      const gx = typeof roomNode.x === 'number' ? roomNode.x + dx : null;
      const gy = typeof roomNode.y === 'number' ? roomNode.y + dy : null;

      if (!gapById[gapId]) {
        gapById[gapId] = {
          id: gapId,
          kind: 'lantern',
          lantern: null,
          lanternRef: gapId,
          active: false,
          x: gx,
          y: gy,
          rooms: [],
          sides: [],
          conflicts: [],
        };
      }

      const gap = gapById[gapId];
      if (typeof gap.x !== 'number' && typeof gx === 'number') gap.x = gx;
      if (typeof gap.y !== 'number' && typeof gy === 'number') gap.y = gy;

      if (!gap.rooms.includes(roomId)) gap.rooms.push(roomId);
      if (hasNeighbor && !gap.rooms.includes(neighbor)) gap.rooms.push(neighbor);

      if (!gap.sides.includes(sideKey)) gap.sides.push(sideKey);
      if (hasNeighbor) {
        const otherSide = `${neighbor}:${OPP[dir]}`;
        if (!gap.sides.includes(otherSide)) gap.sides.push(otherSide);
      }

      if (openSet.has(dir)) {
        gap.active = true;
      }

      const c = firstLanternColor(sideLanterns[dir]);
      if (c) {
        if (!gap.lantern) {
          gap.lantern = c;
        } else if (gap.lantern !== c) {
          gap.conflicts.push({ roomId, dir, color: c, existing: gap.lantern });
        }
      }
    }
  }

  // materialize gap nodes
  const lanternSlots = {};
  for (const [gapId, gap] of Object.entries(gapById)) {
    ensureNode(nodes, gapId, {
      kind: 'lantern',
      slotId: gapId,
      lantern: gap.lantern || null,
      lanternRef: gap.lanternRef || gapId,
      active: gap.active !== false,
      x: gap.x,
      y: gap.y,
      rooms: gap.rooms.slice(),
      sides: gap.sides.slice(),
      conflicts: gap.conflicts.slice(),
    });

    lanternSlots[gapId] = {
      id: gapId,
      ref: gapId,
      color: gap.lantern || null,
      active: gap.active !== false,
      sides: gap.sides.slice(),
      conflicts: gap.conflicts.slice(),
    };
  }

  // 3) Room <-> Gap edges (movement through hallways)
  for (const roomId of roomIds) {
    const roomNode = nodes[roomId];
    for (const dir of DIRS) {
      const gapId = sideToSlot[`${roomId}:${dir}`];
      if (!gapId || !nodes[gapId]) continue;

      addNeighbor(roomNode.neighbors, dir, gapId);
      addNeighbor(nodes[gapId].neighbors, OPP[dir], roomId);
    }
  }

  // 4) Intersection nodes and Gap <-> Intersection edges
  const intersections = {};

  for (const gapId of Object.keys(gapById)) {
    const gap = nodes[gapId];
    if (!gap) continue;

    const gx = Number(gap.x);
    const gy = Number(gap.y);
    if (!Number.isFinite(gx) || !Number.isFinite(gy)) continue;

    let points = [];
    const xEven = gx % 2 === 0;
    const yEven = gy % 2 === 0;

    if (xEven && !yEven) {
      // horizontal gap, intersections above/below
      points = [[gx, gy - 1], [gx, gy + 1]];
    } else if (!xEven && yEven) {
      // vertical gap, intersections left/right
      points = [[gx - 1, gy], [gx + 1, gy]];
    } else {
      continue;
    }

    for (const [ix, iy] of points) {
      const iid = `i(${ix},${iy})`;
      if (!intersections[iid]) {
        intersections[iid] = {
          id: iid,
          kind: 'intersection',
          x: ix,
          y: iy,
          active: true,
        };
      }

      ensureNode(nodes, iid, intersections[iid]);

      const dirGapToI = dirFromDelta(ix - gx, iy - gy);
      const dirIToGap = dirFromDelta(gx - ix, gy - iy);
      if (!dirGapToI || !dirIToGap) continue;

      addNeighbor(nodes[gapId].neighbors, dirGapToI, iid);
      addNeighbor(nodes[iid].neighbors, dirIToGap, gapId);
    }
  }

  // 4b) Ensure the bottom corridor intersections are stitched left↔right.
  // South boundary gaps g(vA1..g(vE1)) are handled like any other lantern gaps.
  if (!includeRank0Rooms) {
    const maxBottomX = files.length * 2;

    for (let x = 0; x <= maxBottomX; x += 2) {
      const id = `i(${x},0)`;
      ensureNode(nodes, id, {
        kind: 'intersection',
        x,
        y: 0,
        active: true,
      });
    }

    for (let x = 0; x < maxBottomX; x += 2) {
      const a = `i(${x},0)`;
      const b = `i(${x + 2},0)`;
      addNeighbor(nodes[a].neighbors, 'E', b);
      addNeighbor(nodes[b].neighbors, 'W', a);
    }
  }

  const knownPaths =
    roomMap.knownPaths && typeof roomMap.knownPaths === 'object'
      ? roomMap.knownPaths
      : {};

  return {
    name: `${roomMap.name || 'Blueprint'} (ILR lattice model)`,
    coordinateSystem: {
      files,
      ranks,
      note: 'Node types: room (R), lantern gap (L), intersection (I). IDs: room=A1.., lantern=g(...), intersection=i(x,y).',
    },
    startId:
      roomMap.startId === 'C0'
        ? 'g(vC1)'
        : (roomMap.startId || 'g(vC1)'),
    nodes,
    lanternSlots,
    sideToSlot,
    knownPaths,
    notes: [
      ...(Array.isArray(roomMap.notes) ? roomMap.notes : []),
      'Converted to ILR lattice model (intersection/lantern/room).',
      'Lantern gaps are explicit hallway nodes between rooms and intersections.',
      'Bottom corridor is modeled as alternating intersections and south-boundary gaps g(vA1..g(vE1)).'
    ],
  };
}

function main() {
  const inputPath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(__dirname, 'data', 'map.rooms.backup.json');

  const outputPath = process.argv[3]
    ? path.resolve(process.argv[3])
    : path.join(__dirname, 'data', 'map.default.json');

  const src = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const graphMap = src.nodes ? src : convertRoomsToGraphMap(src);
  fs.writeFileSync(outputPath, `${JSON.stringify(graphMap, null, 2)}\n`, 'utf8');

  // eslint-disable-next-line no-console
  console.log(`Wrote graph map: ${outputPath}`);
}

if (require.main === module) {
  main();
}

module.exports = {
  convertRoomsToGraphMap,
  canonicalBetweenRooms,
  outerGapId,
};
