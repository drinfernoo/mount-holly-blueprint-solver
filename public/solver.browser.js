'use strict';

const DIRS = ['N', 'E', 'S', 'W'];
const OPPOSITE = { N: 'S', E: 'W', S: 'N', W: 'E' };
const LEFT_OF = { N: 'W', E: 'N', S: 'E', W: 'S' };
const RIGHT_OF = { N: 'E', E: 'S', S: 'W', W: 'N' };

function uniq(arr) {
  return [...new Set(arr)];
}

function normalizeList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeColor(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim().toLowerCase();
  return s || null;
}

function normalizeLetter(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim().toUpperCase();
  return s || null;
}

function normalizeDirList(value) {
  if (value === null || value === undefined) return [];
  const list = Array.isArray(value) ? value : [value];
  const out = [];
  for (const item of list) {
    const d = String(item || '').trim().toUpperCase();
    if (!DIRS.includes(d)) continue;
    if (!out.includes(d)) out.push(d);
  }
  return out;
}

function normalizeColorList(value) {
  if (value === null || value === undefined) return [];
  const list = Array.isArray(value) ? value : [value];
  const out = [];
  for (const item of list) {
    const raw =
      item && typeof item === 'object' && !Array.isArray(item)
        ? (item.color || item.lantern || item.value || null)
        : item;
    const c = normalizeColor(raw);
    if (c) out.push(c);
  }
  return out;
}

function normalizeRef(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s || null;
}

function normalizeRefList(value) {
  if (value === null || value === undefined) return [];
  const list = Array.isArray(value) ? value : [value];
  const out = [];
  for (const item of list) {
    const ref = normalizeRef(
      item && typeof item === 'object'
        ? (item.ref || item.id || item.node || item.position || null)
        : item
    );
    if (ref) out.push(ref);
  }
  return out;
}

function extractRefListFromLanternRaw(value) {
  if (value === null || value === undefined) return [];
  const list = Array.isArray(value) ? value : [value];
  const out = [];
  for (const item of list) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const ref = normalizeRef(item.ref || item.id || item.node || item.position || null);
    if (ref) out.push(ref);
  }
  return out;
}

function normalizeLanternCandidates(primaryRaw, listRaw, primaryRefRaw = null, refsRaw = []) {
  const list = normalizeColorList(listRaw);
  const refs = normalizeRefList(refsRaw);

  const primary = normalizeColor(primaryRaw);
  const primaryRef = normalizeRef(primaryRefRaw);

  if (primary) {
    const idx = list.findIndex((c) => c === primary);
    if (idx === -1) {
      list.unshift(primary);
      refs.unshift(primaryRef);
    } else if (primaryRef && !refs[idx]) {
      refs[idx] = primaryRef;
    }
  }

  while (refs.length < list.length) refs.push(null);
  if (refs.length > list.length) refs.length = list.length;

  return {
    primary: primary || list[0] || null,
    list,
    primaryRef: primaryRef || refs[0] || null,
    refs,
  };
}

function normalizeLanternListWithRefs(colorsRaw, refsRaw = []) {
  const list = normalizeColorList(colorsRaw);
  const refs = normalizeRefList(refsRaw);
  while (refs.length < list.length) refs.push(null);
  if (refs.length > list.length) refs.length = list.length;
  return { list, refs };
}

function normalizeLanternEventList(value) {
  if (value === null || value === undefined) return [];
  const list = Array.isArray(value) ? value : [value];
  const out = [];
  for (const item of list) {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const color = normalizeColor(item.color || item.lantern || item.value || null);
      if (!color) continue;
      out.push({ color, ref: normalizeRef(item.ref || item.id || item.node || null) });
    } else {
      const color = normalizeColor(item);
      if (!color) continue;
      out.push({ color, ref: null });
    }
  }
  return out;
}

function normalizeTurn(value) {
  if (!value) return null;
  const s = String(value).trim().toLowerCase();
  if (s === 'left' || s === 'l') return 'L';
  if (s === 'right' || s === 'r') return 'R';
  if (s === 'straight' || s === 's' || s === 'forward' || s === 'f') return 'S';
  if (s === 'back' || s === 'u' || s === 'reverse') return 'B';
  if (s === 'any' || s === '*' || s === 'a') return 'A';
  return null;
}

function turnRelation(fromHeading, toHeading) {
  if (!fromHeading || !toHeading) return null;
  if (toHeading === fromHeading) return 'S';
  if (toHeading === LEFT_OF[fromHeading]) return 'L';
  if (toHeading === RIGHT_OF[fromHeading]) return 'R';
  if (toHeading === OPPOSITE[fromHeading]) return 'B';
  return null;
}

function parseRoomId(id) {
  const m = String(id).trim().toUpperCase().match(/^([A-Z]+)(\d+)$/);
  if (!m) return null;
  return { file: m[1], rank: Number(m[2]) };
}

function makeRoomId(file, rank) {
  return `${file}${rank}`;
}

function inferFilesFromRoomIds(roomIds) {
  const files = uniq(
    roomIds
      .map((id) => parseRoomId(id))
      .filter(Boolean)
      .map((p) => p.file)
  );
  return files.sort();
}

function inferRanksFromRoomIds(roomIds) {
  const ranks = uniq(
    roomIds
      .map((id) => parseRoomId(id))
      .filter(Boolean)
      .map((p) => p.rank)
  );
  return ranks.sort((a, b) => a - b);
}

function roomShift(roomId, dir, files, rankSet) {
  const parsed = parseRoomId(roomId);
  if (!parsed) return null;

  const fileIndex = files.indexOf(parsed.file);
  if (fileIndex === -1) return null;

  let nextFileIndex = fileIndex;
  let nextRank = parsed.rank;

  if (dir === 'N') nextRank += 1;
  if (dir === 'S') nextRank -= 1;
  if (dir === 'E') nextFileIndex += 1;
  if (dir === 'W') nextFileIndex -= 1;

  if (nextFileIndex < 0 || nextFileIndex >= files.length) return null;
  if (!rankSet.has(nextRank)) return null;

  return makeRoomId(files[nextFileIndex], nextRank);
}

function buildGraphFromNodesMap(map) {
  const rawNodes = map.nodes || {};
  const nodeIds = Object.keys(rawNodes);
  if (!nodeIds.length) {
    throw new Error('map.nodes is empty');
  }

  const nodes = {};
  for (const nodeId of nodeIds) {
    const node = rawNodes[nodeId] || {};
    nodes[nodeId] = {
      id: nodeId,
      kind: String(node.kind || '').trim().toLowerCase() || null,
      letter: normalizeLetter(node.letter),
      lantern: normalizeColor(node.lantern),
      lanternRef: normalizeRef(node.lanternRef || node.lanternId || null),
      enabledDirs: normalizeDirList(node.enabledDirs || node.open || node.connections || []),
      active: node.active !== false,
      neighbors: {},
    };
  }

  function addNeighborEdge(neighborMap, dir, edgeObj) {
    const existing = neighborMap[dir];
    if (!existing) {
      neighborMap[dir] = edgeObj;
      return;
    }
    if (Array.isArray(existing)) {
      existing.push(edgeObj);
      return;
    }
    neighborMap[dir] = [existing, edgeObj];
  }

  function parseNeighborTarget(targetRaw) {
    let targetId = null;
    let lantern = null;
    let lanternRef = null;
    let lanterns = [];
    let lanternRefs = [];
    let lanternSlot = null;
    let passLanterns = [];
    let passLanternRefs = [];
    let passLanternSlots = [];
    let active = true;

    if (typeof targetRaw === 'string') {
      targetId = targetRaw;
    } else if (targetRaw && typeof targetRaw === 'object' && !Array.isArray(targetRaw)) {
      targetId = targetRaw.to || targetRaw.target || targetRaw.id || null;

      const candidates = normalizeLanternCandidates(
        targetRaw.lantern || targetRaw.color || null,
        targetRaw.lanterns || targetRaw.altLanterns || targetRaw.colors || [],
        targetRaw.lanternRef || targetRaw.colorRef || null,
        targetRaw.lanternRefs || targetRaw.colorRefs || []
      );

      const pass = normalizeLanternListWithRefs(
        targetRaw.passLanterns || targetRaw.passColors || [],
        targetRaw.passLanternRefs || targetRaw.passColorRefs || []
      );

      lantern = candidates.primary;
      lanternRef = candidates.primaryRef;
      lanterns = candidates.list;
      lanternRefs = candidates.refs;
      lanternSlot = normalizeRef(targetRaw.lanternSlot || targetRaw.slot || null);
      passLanterns = pass.list;
      passLanternRefs = pass.refs;
      passLanternSlots = normalizeRefList(
        targetRaw.passLanternSlots || targetRaw.passSlots || []
      );
      active = targetRaw.active !== false;
    }

    if (!targetId || !nodes[targetId]) return null;

    return {
      to: targetId,
      lantern,
      lanternRef,
      lanterns,
      lanternRefs,
      lanternSlot,
      passLanterns,
      passLanternRefs,
      passLanternSlots,
      active,
    };
  }

  for (const nodeId of nodeIds) {
    const node = rawNodes[nodeId] || {};
    const neighbors = node.neighbors || node.edges || {};

    if (Array.isArray(neighbors)) {
      // edge list style: [{dir:"N",to:"B2",...}, ...]
      for (const edge of neighbors) {
        if (!edge || !edge.to) continue;
        const dir = String(edge.dir || '').trim().toUpperCase();
        if (!DIRS.includes(dir)) continue;

        const parsed = parseNeighborTarget(edge);
        if (!parsed) continue;
        addNeighborEdge(nodes[nodeId].neighbors, dir, parsed);
      }
    } else if (neighbors && typeof neighbors === 'object') {
      // object style:
      // {N:"B2", E:{to:"C1", ...}, W:[{to:"Q1"},{to:"Q2"}]}
      for (const [dirRaw, targetRaw] of Object.entries(neighbors)) {
        const dir = String(dirRaw).trim().toUpperCase();
        if (!DIRS.includes(dir)) continue;

        const targetList = Array.isArray(targetRaw) ? targetRaw : [targetRaw];
        for (const oneTarget of targetList) {
          const parsed = parseNeighborTarget(oneTarget);
          if (!parsed) continue;
          addNeighborEdge(nodes[nodeId].neighbors, dir, parsed);
        }
      }
    }
  }

  const lanternSlotsRaw =
    map.lanternSlots && typeof map.lanternSlots === 'object' ? map.lanternSlots : {};

  const lanternSlots = {};
  for (const [slotIdRaw, slotRaw] of Object.entries(lanternSlotsRaw)) {
    const slotId = normalizeRef(slotIdRaw);
    if (!slotId) continue;

    const slotObj = slotRaw && typeof slotRaw === 'object' ? slotRaw : {};
    const color = normalizeColor(slotObj.color || slotObj.lantern || null);
    lanternSlots[slotId] = {
      id: slotId,
      color,
      ref: normalizeRef(slotObj.ref || slotObj.id || slotId) || slotId,
      active: slotObj.active !== false,
    };
  }

  const sideToSlotRaw =
    map.sideToSlot && typeof map.sideToSlot === 'object' ? map.sideToSlot : {};
  const sideToSlot = new Map();
  for (const [nodeId, slotIdRaw] of Object.entries(sideToSlotRaw)) {
    const slotId = normalizeRef(slotIdRaw);
    if (!slotId) continue;
    sideToSlot.set(String(nodeId), slotId);
  }

  return {
    nodes,
    startId: map.startId || nodeIds[0],
    mode: 'graph',
    lanternSlots,
    sideToSlot,
  };
}

function buildGraphFromRoomsMap(map) {
  const rooms = map.rooms || {};
  const roomIds = Object.keys(rooms);
  if (!roomIds.length) {
    throw new Error('map.rooms is empty');
  }

  const files = Array.isArray(map.files)
    ? map.files.map((f) => String(f).trim().toUpperCase()).filter(Boolean)
    : inferFilesFromRoomIds(roomIds);

  const ranks = Array.isArray(map.ranks)
    ? map.ranks.map((r) => Number(r)).filter((r) => Number.isFinite(r))
    : inferRanksFromRoomIds(roomIds);

  const rankSet = new Set(ranks);

  const nodes = {};
  for (const roomId of roomIds) {
    const room = rooms[roomId] || {};
    nodes[roomId] = {
      id: roomId,
      kind: String(room.kind || 'room').trim().toLowerCase(),
      letter: normalizeLetter(room.letter),
      lantern: normalizeColor(room.lantern),
      lanternRef: normalizeRef(room.lanternRef || room.lanternId || null),
      enabledDirs: normalizeDirList(room.enabledDirs || room.open || room.connections || []),
      active: room.active !== false,
      neighbors: {},
    };
  }

  const defaultOpenAll = String(map.defaultOpen || '').trim().toLowerCase() === 'all';

  for (const roomId of roomIds) {
    const room = rooms[roomId] || {};
    const explicitNeighbors =
      room.neighbors && typeof room.neighbors === 'object' ? room.neighbors : {};

    const sideLanternsRaw =
      (room.sideLanterns && typeof room.sideLanterns === 'object')
        ? room.sideLanterns
        : (room.edgeLanterns && typeof room.edgeLanterns === 'object')
          ? room.edgeLanterns
          : (room.lanterns && typeof room.lanterns === 'object')
            ? room.lanterns
            : {};

    const sideLanternRefsRaw =
      (room.sideLanternRefs && typeof room.sideLanternRefs === 'object')
        ? room.sideLanternRefs
        : (room.lanternRefs && typeof room.lanternRefs === 'object')
          ? room.lanternRefs
          : {};

    const sidePassLanternsRaw =
      (room.passLanterns && typeof room.passLanterns === 'object')
        ? room.passLanterns
        : (room.edgePassLanterns && typeof room.edgePassLanterns === 'object')
          ? room.edgePassLanterns
          : {};

    const sidePassLanternRefsRaw =
      (room.passLanternRefs && typeof room.passLanternRefs === 'object')
        ? room.passLanternRefs
        : (room.edgePassLanternRefs && typeof room.edgePassLanternRefs === 'object')
          ? room.edgePassLanternRefs
          : {};

    const sideLanterns = {};
    const sideLanternRefs = {};

    for (const [dirRaw, colorRaw] of Object.entries(sideLanternsRaw)) {
      const dir = String(dirRaw).trim().toUpperCase();
      if (!DIRS.includes(dir)) continue;
      const colors = normalizeColorList(colorRaw);
      if (!colors.length) continue;
      sideLanterns[dir] = colors;

      const refsFromInline = extractRefListFromLanternRaw(colorRaw);
      if (refsFromInline.length) {
        sideLanternRefs[dir] = refsFromInline;
      }
    }

    for (const [dirRaw, refsRaw] of Object.entries(sideLanternRefsRaw)) {
      const dir = String(dirRaw).trim().toUpperCase();
      if (!DIRS.includes(dir)) continue;
      const refs = normalizeRefList(refsRaw);
      if (!refs.length) continue;
      sideLanternRefs[dir] = refs;
    }

    const sidePassLanterns = {};
    const sidePassLanternRefs = {};

    for (const [dirRaw, listRaw] of Object.entries(sidePassLanternsRaw)) {
      const dir = String(dirRaw).trim().toUpperCase();
      if (!DIRS.includes(dir)) continue;
      const list = normalizeColorList(listRaw);
      if (!list.length) continue;
      sidePassLanterns[dir] = list;

      const refsFromInline = extractRefListFromLanternRaw(listRaw);
      if (refsFromInline.length) {
        sidePassLanternRefs[dir] = refsFromInline;
      }
    }

    for (const [dirRaw, refsRaw] of Object.entries(sidePassLanternRefsRaw)) {
      const dir = String(dirRaw).trim().toUpperCase();
      if (!DIRS.includes(dir)) continue;
      const refs = normalizeRefList(refsRaw);
      if (!refs.length) continue;
      sidePassLanternRefs[dir] = refs;
    }

    // explicit neighbors first
    for (const [dirRaw, targetRaw] of Object.entries(explicitNeighbors)) {
      const dir = String(dirRaw).trim().toUpperCase();
      if (!DIRS.includes(dir)) continue;

      let targetId = null;
      let lanternCandidates = sideLanterns[dir] ? sideLanterns[dir].slice() : [];
      let lanternCandidateRefs = sideLanternRefs[dir] ? sideLanternRefs[dir].slice() : [];
      let passLanterns = sidePassLanterns[dir] ? sidePassLanterns[dir].slice() : [];
      let passLanternRefs = sidePassLanternRefs[dir] ? sidePassLanternRefs[dir].slice() : [];

      if (typeof targetRaw === 'string') {
        targetId = targetRaw;
      } else if (targetRaw && typeof targetRaw === 'object') {
        targetId = targetRaw.to || targetRaw.target || targetRaw.id || null;

        const candidates = normalizeLanternCandidates(
          targetRaw.lantern || targetRaw.color || null,
          targetRaw.lanterns || targetRaw.altLanterns || targetRaw.colors || lanternCandidates,
          targetRaw.lanternRef || targetRaw.colorRef || null,
          targetRaw.lanternRefs || targetRaw.colorRefs || lanternCandidateRefs
        );
        lanternCandidates = candidates.list;
        lanternCandidateRefs = candidates.refs;

        const pass = normalizeLanternListWithRefs(
          targetRaw.passLanterns || targetRaw.passColors || passLanterns,
          targetRaw.passLanternRefs || targetRaw.passColorRefs || passLanternRefs
        );
        passLanterns = pass.list;
        passLanternRefs = pass.refs;
      }

      if (!targetId || !nodes[targetId]) continue;
      nodes[roomId].neighbors[dir] = {
        to: targetId,
        lantern: lanternCandidates[0] || null,
        lanternRef: lanternCandidateRefs[0] || null,
        lanterns: lanternCandidates,
        lanternRefs: lanternCandidateRefs,
        passLanterns,
        passLanternRefs,
      };
    }

    // then open-direction neighbors (to adjacent chess-square rooms)
    const openDirs = Array.isArray(room.open)
      ? room.open.map((d) => String(d).trim().toUpperCase())
      : defaultOpenAll
        ? DIRS
        : [];

    for (const dir of openDirs) {
      if (!DIRS.includes(dir)) continue;
      if (nodes[roomId].neighbors[dir]) continue;

      const targetId = roomShift(roomId, dir, files, rankSet);
      if (!targetId || !nodes[targetId]) continue;

      const lanternCandidates = sideLanterns[dir] ? sideLanterns[dir].slice() : [];
      const lanternCandidateRefs = sideLanternRefs[dir] ? sideLanternRefs[dir].slice() : [];
      const pass = normalizeLanternListWithRefs(
        sidePassLanterns[dir] ? sidePassLanterns[dir].slice() : [],
        sidePassLanternRefs[dir] ? sidePassLanternRefs[dir].slice() : []
      );

      nodes[roomId].neighbors[dir] = {
        to: targetId,
        lantern: lanternCandidates[0] || null,
        lanternRef: lanternCandidateRefs[0] || null,
        lanterns: lanternCandidates,
        lanternRefs: lanternCandidateRefs,
        passLanterns: pass.list,
        passLanternRefs: pass.refs,
      };
    }
  }

  return {
    nodes,
    startId: map.startId || 'A1',
    mode: 'rooms',
    files,
    ranks,
    lanternSlots: {},
    sideToSlot: new Map(),
  };
}

function buildGraph(map) {
  if (!map || typeof map !== 'object') {
    throw new Error('map must be an object');
  }

  if (map.nodes) return buildGraphFromNodesMap(map);
  if (map.rooms) return buildGraphFromRoomsMap(map);

  throw new Error('map must include either "nodes" or "rooms"');
}

function applyLanternPreset(rawRule) {
  const rule = String(rawRule || '').trim().toLowerCase();
  if (!rule) return null;

  if (rule === 'red-only') {
    return { allowedColors: ['red'] };
  }
  if (rule === 'orange-only') {
    return { allowedColors: ['orange'] };
  }
  if (rule === 'purple-only') {
    return { allowedColors: ['purple'] };
  }

  return null;
}

function buildConstraints(query, graph) {
  const q = query && typeof query === 'object' ? query : {};

  const mustUseRooms = uniq(
    normalizeList(q.mustUseRooms || q.mustUseNodes || [])
      .map((x) => String(x).trim())
      .filter((x) => !!graph.nodes[x])
  );

  const roomBit = new Map();
  let requiredRoomMask = 0n;
  for (let i = 0; i < mustUseRooms.length; i += 1) {
    const bit = 1n << BigInt(i);
    roomBit.set(mustUseRooms[i], bit);
    requiredRoomMask |= bit;
  }

  const mustVisitNodesInOrder = normalizeList(
    q.mustVisitNodesInOrder ||
    q.nodeOrder ||
    q.orderedNodes ||
    []
  )
    .map((x) => String(x).trim())
    .filter(Boolean);

  const letterModeRaw = String(q.letterMode || 'any_order').trim().toLowerCase();

  let letterMode = 'any';
  if (letterModeRaw.startsWith('ord')) {
    letterMode = letterModeRaw.includes('strict')
      ? 'ordered-strict'
      : 'ordered-subsequence';
  } else if (
    letterModeRaw === 'subsequence' ||
    letterModeRaw === 'ordered_subsequence' ||
    letterModeRaw === 'ordered-subsequence'
  ) {
    letterMode = 'ordered-subsequence';
  } else if (
    letterModeRaw === 'strict' ||
    letterModeRaw === 'strict_ordered' ||
    letterModeRaw === 'ordered_strict' ||
    letterModeRaw === 'ordered-strict'
  ) {
    letterMode = 'ordered-strict';
  }

  const orderedLetters = normalizeList(
    q.mustUseLetters ||
    q.orderedLetters ||
    q.letterOrder ||
    q.letters ||
    []
  )
    .map(normalizeLetter)
    .filter(Boolean);

  const countsMap = new Map();
  if (letterMode === 'any') {
    for (const letter of orderedLetters) {
      countsMap.set(letter, (countsMap.get(letter) || 0) + 1);
    }

    if (q.letterCounts && typeof q.letterCounts === 'object') {
      for (const [letterRaw, countRaw] of Object.entries(q.letterCounts)) {
        const letter = normalizeLetter(letterRaw);
        const count = Number(countRaw);
        if (!letter || !Number.isFinite(count) || count <= 0) continue;
        countsMap.set(letter, Math.max(countsMap.get(letter) || 0, Math.floor(count)));
      }
    }
  }

  const letterKeys = [...countsMap.keys()];
  const letterTargets = letterKeys.map((k) => countsMap.get(k));
  const letterKeyIndex = new Map(letterKeys.map((k, i) => [k, i]));

  const preset = applyLanternPreset(q.lanternRule);
  const lanternConfig = {
    ...(preset || {}),
    ...((q.lantern && typeof q.lantern === 'object') ? q.lantern : {}),
  };

  let allowedColors = uniq(
    normalizeList(
      lanternConfig.allowedColors ||
      lanternConfig.only ||
      q.allowedLanternColors ||
      q.allowedLanterns ||
      []
    )
      .map(normalizeColor)
      .filter(Boolean)
  );

  const orderedColors = normalizeList(
    lanternConfig.orderedColors ||
    lanternConfig.sequence ||
    q.lanternOrder ||
    []
  )
    .map(normalizeColor)
    .filter(Boolean);

  const turnRulesRaw =
    (lanternConfig.turnRules && typeof lanternConfig.turnRules === 'object')
      ? lanternConfig.turnRules
      : (q.turnRules && typeof q.turnRules === 'object')
        ? q.turnRules
        : {};

  const turnRules = new Map();
  let intersectionTurnRule = null;

  const INTERSECTION_RULE_KEYS = new Set([
    'intersection',
    'intersections',
    'no_lantern',
    'no-lantern',
    'nolanter',
    'none',
    'default',
    'hallway',
  ]);

  for (const [keyRaw, turnRaw] of Object.entries(turnRulesRaw)) {
    const key = String(keyRaw || '').trim().toLowerCase();
    const turn = normalizeTurn(turnRaw);
    if (!turn) continue;

    if (INTERSECTION_RULE_KEYS.has(key)) {
      intersectionTurnRule = turn;
      continue;
    }

    const color = normalizeColor(keyRaw);
    if (!color) continue;
    turnRules.set(color, turn);
  }

  const startColor = normalizeColor(
    lanternConfig.startColor || q.startLanternColor || null
  );

  // If turn rules are defined but allowedColors is omitted, default to the
  // rule colors (+ optional start color). This matches puzzle semantics where
  // unspecified colors are not considered valid for that custom rule-set.
  if (allowedColors.length === 0 && turnRules.size > 0) {
    const implied = [];
    if (startColor) implied.push(startColor);
    for (const color of turnRules.keys()) implied.push(color);
    allowedColors = uniq(implied);
  }

  const mustUseLanternRefs = uniq(
    normalizeList(
      lanternConfig.mustUseRefs ||
      lanternConfig.requiredRefs ||
      q.mustUseLanternRefs ||
      q.mustUseLanternNodes ||
      q.mustUseLanternIds ||
      []
    )
      .map(normalizeRef)
      .filter(Boolean)
  );

  const lanternRefBit = new Map();
  let requiredLanternRefMask = 0n;
  for (let i = 0; i < mustUseLanternRefs.length; i += 1) {
    const bit = 1n << BigInt(i);
    lanternRefBit.set(mustUseLanternRefs[i], bit);
    requiredLanternRefMask |= bit;
  }

  const orderedLanternRefs = normalizeList(
    lanternConfig.refOrder ||
    lanternConfig.orderedRefs ||
    q.lanternRefOrder ||
    q.orderedLanternRefs ||
    []
  )
    .map(normalizeRef)
    .filter(Boolean);

  const orderedLanternRefSet = new Set(orderedLanternRefs);

  const maxStepsRaw = Number(q.maxSteps);
  const maxSteps = Number.isFinite(maxStepsRaw) && maxStepsRaw >= 0 ? Math.floor(maxStepsRaw) : 120;

  const maxStatesRaw = Number(q.maxStates);
  const maxStatesRequested = Number.isFinite(maxStatesRaw) && maxStatesRaw > 0
    ? Math.floor(maxStatesRaw)
    : 50000;
  const maxStates = Math.min(maxStatesRequested, 250000);

  const minStepsRaw = Number(q.minSteps);
  const minSteps = Number.isFinite(minStepsRaw) && minStepsRaw >= 0 ? Math.floor(minStepsRaw) : 0;

  const allowImmediateBacktrack =
    q.allowImmediateBacktrack === true ||
    q.allowUturn === true ||
    q.allowReverse === true;

  const noRevisitNodes =
    q.noRevisitNodes !== false &&
    q.disallowRevisitNodes !== false &&
    q.simplePath !== false &&
    q.allowCrossing !== true &&
    q.allowCircuit !== true &&
    q.allowCircuits !== true &&
    q.allowLoops !== true;

  const nodeBit = new Map();
  let nodeBitIndex = 0;
  for (const nodeId of Object.keys(graph.nodes || {})) {
    nodeBit.set(nodeId, 1n << BigInt(nodeBitIndex));
    nodeBitIndex += 1;
  }

  const searchModeRaw = String(q.searchMode || q.search || '').trim().toLowerCase();
  const autoUseDfs = noRevisitNodes && letterMode !== 'any';
  const searchMode =
    searchModeRaw.startsWith('df') ? 'dfs'
      : searchModeRaw.startsWith('bf') ? 'bfs'
      : autoUseDfs ? 'dfs'
      : 'bfs';

  const dirPriorityInput = normalizeDirList(
    q.directionPriority ||
    q.dirPriority ||
    q.moveDirectionPriority ||
    (q.simulation && typeof q.simulation === 'object' ? q.simulation.directionPriority : null) ||
    []
  );
  const dirPriority = dirPriorityInput.length
    ? uniq([...dirPriorityInput, ...DIRS])
    : DIRS.slice();
  const dirPriorityIndex = new Map(dirPriority.map((d, i) => [d, i]));

  return {
    startId: q.startId || graph.startId,
    endId: q.endId || null,
    maxSteps,
    maxStates,
    minSteps,
    allowImmediateBacktrack,
    noRevisitNodes,
    nodeBit,
    searchMode,
    dirPriority,
    dirPriorityIndex,

    mustUseRooms,
    roomBit,
    requiredRoomMask,

    mustVisitNodesInOrder,

    letterMode,
    orderedLetters,
    letterKeys,
    letterTargets,
    letterKeyIndex,

    allowedColors: new Set(allowedColors),
    orderedColors,
    turnRules,
    intersectionTurnRule,
    startColor,

    mustUseLanternRefs,
    lanternRefBit,
    requiredLanternRefMask,
    orderedLanternRefs,
    orderedLanternRefSet,

    lanternSlots: graph.lanternSlots || {},
    sideToSlot:
      graph.sideToSlot instanceof Map
        ? graph.sideToSlot
        : new Map(Object.entries(graph.sideToSlot || {})),
  };
}

function cloneProgress(progress) {
  return {
    roomMask: progress.roomMask,
    nodeOrderIndex: progress.nodeOrderIndex,
    letterIndex: progress.letterIndex,
    letterCounts: progress.letterCounts.slice(),
    lanternIndex: progress.lanternIndex,
    firstLanternSeen: progress.firstLanternSeen,
    lanternRefMask: progress.lanternRefMask,
    lanternRefOrderIndex: progress.lanternRefOrderIndex,
    visitedNodeMask: progress.visitedNodeMask,
    lastLanternRef: progress.lastLanternRef,
  };
}

function getEnabledDirSet(node) {
  const dirs = normalizeDirList(node && node.enabledDirs);
  if (dirs.length > 0) return new Set(dirs);
  return new Set(DIRS);
}

function getLanternEventFromSlot(slotIdRaw, constraints) {
  const slotId = normalizeRef(slotIdRaw);
  if (!slotId) return null;

  const slot = constraints.lanternSlots && constraints.lanternSlots[slotId];
  if (!slot || typeof slot !== 'object') return null;

  const color = normalizeColor(slot.color || slot.lantern || null);
  if (!color) return null;

  const ref = normalizeRef(slot.ref || slot.id || slotId) || slotId;
  return { color, ref, slotId };
}

function getEdgeSlotId(currentNodeId, nextNodeId, edge, constraints) {
  const explicit = normalizeRef(edge.lanternSlot || edge.slot || null);
  if (explicit) return explicit;

  const currentSideSlot = constraints.sideToSlot && constraints.sideToSlot.get(currentNodeId);
  if (currentSideSlot && nextNodeId === currentSideSlot) return currentSideSlot;

  const nextSideSlot = constraints.sideToSlot && constraints.sideToSlot.get(nextNodeId);
  if (nextSideSlot && currentNodeId === nextSideSlot) return nextSideSlot;

  if (constraints.lanternSlots && constraints.lanternSlots[currentNodeId]) return currentNodeId;
  if (constraints.lanternSlots && constraints.lanternSlots[nextNodeId]) return nextNodeId;

  return null;
}

function applyLanternToProgress(progress, lanternRaw, constraints) {
  const event =
    lanternRaw && typeof lanternRaw === 'object' && !Array.isArray(lanternRaw)
      ? lanternRaw
      : { color: lanternRaw, ref: null };

  const lantern = normalizeColor(event.color);
  const ref = normalizeRef(event.ref);

  if (!lantern) return { ok: true, applied: false };

  if (ref && progress.lastLanternRef && ref === progress.lastLanternRef) {
    return { ok: true, applied: false };
  }

  if (constraints.startColor && !progress.firstLanternSeen && lantern !== constraints.startColor) {
    return { ok: false, applied: false };
  }

  progress.firstLanternSeen = true;

  if (constraints.allowedColors.size && !constraints.allowedColors.has(lantern)) {
    return { ok: false, applied: false };
  }

  if (constraints.orderedColors.length > 0 && progress.lanternIndex < constraints.orderedColors.length) {
    const expected = constraints.orderedColors[progress.lanternIndex];
    if (lantern !== expected) {
      return { ok: false, applied: false };
    }
    progress.lanternIndex += 1;
  }

  if (ref) {
    const bit = constraints.lanternRefBit.get(ref);
    if (bit) {
      progress.lanternRefMask |= bit;
    }

    if (
      constraints.orderedLanternRefs.length > 0 &&
      progress.lanternRefOrderIndex < constraints.orderedLanternRefs.length
    ) {
      const expectedRef = constraints.orderedLanternRefs[progress.lanternRefOrderIndex];
      if (ref === expectedRef) {
        progress.lanternRefOrderIndex += 1;
      } else if (constraints.orderedLanternRefSet.has(ref)) {
        return { ok: false, applied: false };
      }
    }

    progress.lastLanternRef = ref;
  } else {
    progress.lastLanternRef = null;
  }

  return { ok: true, applied: true };
}

function applyVisit(progress, node, constraints, options = {}) {
  const next = cloneProgress(progress);

  if (constraints.noRevisitNodes) {
    const nodeVisitBit = constraints.nodeBit && constraints.nodeBit.get(node.id);
    if (nodeVisitBit) {
      if ((next.visitedNodeMask & nodeVisitBit) !== 0n) {
        return null;
      }
      next.visitedNodeMask |= nodeVisitBit;
    }
  }

  const edgeEventsRaw =
    options.edgeLanternEvents ||
    options.edgeLanterns ||
    options.edgeLantern ||
    [];

  const edgeLanternEvents = normalizeLanternEventList(edgeEventsRaw);

  let attemptedLanternEvent = false;

  for (const ev of edgeLanternEvents) {
    if (!normalizeColor(ev.color)) continue;
    attemptedLanternEvent = true;

    const res = applyLanternToProgress(next, ev, constraints);
    if (!res.ok) {
      return null;
    }
  }

  // room requirements
  const roomBit = constraints.roomBit.get(node.id);
  if (roomBit) {
    next.roomMask |= roomBit;
  }

  // explicit node-order requirements
  if (
    constraints.mustVisitNodesInOrder.length > 0 &&
    next.nodeOrderIndex < constraints.mustVisitNodesInOrder.length &&
    node.id === constraints.mustVisitNodesInOrder[next.nodeOrderIndex]
  ) {
    next.nodeOrderIndex += 1;
  }

  // letter requirements
  const letter = normalizeLetter(node.letter);
  if (constraints.letterMode !== 'any') {
    // No extra letters: every encountered letter room must match the next
    // required ordered letter, and letters beyond the target sequence are invalid.
    if (letter && constraints.orderedLetters.length > 0) {
      if (next.letterIndex >= constraints.orderedLetters.length) {
        return null;
      }
      const expected = constraints.orderedLetters[next.letterIndex];
      if (letter !== expected) {
        return null;
      }
      next.letterIndex += 1;
    }
  } else if (letter && constraints.letterTargets.length > 0) {
    // Any-order mode is exact-multiset matching when letter requirements exist:
    // no unexpected letters and no extra repeats beyond required counts.
    if (!constraints.letterKeyIndex.has(letter)) {
      return null;
    }
    const idx = constraints.letterKeyIndex.get(letter);
    if (next.letterCounts[idx] >= constraints.letterTargets[idx]) {
      return null;
    }
    next.letterCounts[idx] += 1;
  }

  // node-level lantern requirements (optional)
  const nodeLantern = normalizeColor(node.lantern);
  if (nodeLantern) {
    const nodeLanternRef = normalizeRef(node.lanternRef || null);
    const alreadyApplied = edgeLanternEvents.some(
      (ev) => normalizeColor(ev.color) === nodeLantern && normalizeRef(ev.ref) === nodeLanternRef
    );

    if (!alreadyApplied) {
      attemptedLanternEvent = true;
      const res = applyLanternToProgress(
        next,
        { color: nodeLantern, ref: nodeLanternRef },
        constraints
      );
      if (!res.ok) {
        return null;
      }
    }
  }

  if (!attemptedLanternEvent) {
    next.lastLanternRef = null;
  }

  return next;
}

function passesTurnRule(currentNode, heading, nextDir, constraints, edgeLantern = null) {
  if (!heading) return true; // no prior heading at initial step

  const nodeKind = String(currentNode?.kind || '').trim().toLowerCase();
  const lantern = normalizeColor(edgeLantern || currentNode?.lantern || null);

  let needed = null;
  if (lantern) {
    needed = constraints.turnRules.get(lantern) || null;
  } else if (nodeKind === 'intersection') {
    needed = constraints.intersectionTurnRule || null;
  }

  if (!needed || needed === 'A') return true;

  const rel = turnRelation(heading, nextDir);
  return rel === needed;
}

function buildNextTransitions(current, graph, constraints, options = {}) {
  const node = graph.nodes[current.nodeId];
  if (!node) return [];

  const currentEnabledDirs = getEnabledDirSet(node);
  const useDirPriority = options.useDirPriority === true;

  const neighborEntries = Object.entries(node.neighbors || {})
    .map(([dirRaw, edgeRaw]) => [String(dirRaw || '').trim().toUpperCase(), edgeRaw])
    .filter(([dir]) => DIRS.includes(dir) && currentEnabledDirs.has(dir));

  if (useDirPriority) {
    neighborEntries.sort((a, b) => {
      const ai = constraints.dirPriorityIndex.has(a[0]) ? constraints.dirPriorityIndex.get(a[0]) : 999;
      const bi = constraints.dirPriorityIndex.has(b[0]) ? constraints.dirPriorityIndex.get(b[0]) : 999;
      if (ai !== bi) return ai - bi;
      return a[0].localeCompare(b[0]);
    });
  }

  const out = [];

  for (const [dir, edgeRaw] of neighborEntries) {
    const edgeCandidates = Array.isArray(edgeRaw) ? edgeRaw : [edgeRaw];

    for (const oneEdgeRaw of edgeCandidates) {
      const edge =
        (oneEdgeRaw && typeof oneEdgeRaw === 'object' && !Array.isArray(oneEdgeRaw))
          ? oneEdgeRaw
          : { to: oneEdgeRaw };

      const nextId = edge.to;
      if (!nextId || !graph.nodes[nextId]) continue;

      const slotIdForEdge = getEdgeSlotId(current.nodeId, nextId, edge, constraints);
      const slotEvent = getLanternEventFromSlot(slotIdForEdge, constraints);

      const passSlotIds = normalizeRefList(edge.passLanternSlots || edge.passSlots || []);
      const passSlotEvents = passSlotIds
        .map((slotId) => getLanternEventFromSlot(slotId, constraints))
        .filter(Boolean);

      const pass = normalizeLanternListWithRefs(
        edge.passLanterns || edge.passColors || [],
        edge.passLanternRefs || edge.passColorRefs || []
      );

      let candidateChoices = [];
      let candidateLanternList = [];
      let candidateLanternRefs = [];

      if (slotEvent) {
        candidateChoices = [{
          color: slotEvent.color,
          ref: slotEvent.ref,
          slotId: slotEvent.slotId,
        }];
        candidateLanternList = [slotEvent.color];
        candidateLanternRefs = [slotEvent.ref];
      } else {
        const candidates = normalizeLanternCandidates(
          edge.lantern || edge.color || null,
          edge.lanterns || edge.altLanterns || edge.colors || [],
          edge.lanternRef || edge.colorRef || null,
          edge.lanternRefs || edge.colorRefs || []
        );

        candidateChoices = candidates.list.length
          ? candidates.list.map((color, i) => ({
              color,
              ref: candidates.refs[i] || null,
              slotId: null,
            }))
          : [{ color: null, ref: null, slotId: null }];

        candidateLanternList = candidates.list;
        candidateLanternRefs = candidates.refs;
      }

      for (const chosen of candidateChoices) {
        const edgeLanternEvents = [];
        if (chosen.color) {
          edgeLanternEvents.push({ color: chosen.color, ref: chosen.ref });
        }

        for (const ev of passSlotEvents) {
          const duplicate = edgeLanternEvents.some(
            (x) => normalizeColor(x.color) === ev.color && normalizeRef(x.ref) === normalizeRef(ev.ref)
          );
          if (!duplicate) edgeLanternEvents.push({ color: ev.color, ref: ev.ref });
        }

        for (let i = 0; i < pass.list.length; i += 1) {
          const ev = { color: pass.list[i], ref: pass.refs[i] || null };
          const duplicate = edgeLanternEvents.some(
            (x) => normalizeColor(x.color) === ev.color && normalizeRef(x.ref) === normalizeRef(ev.ref)
          );
          if (!duplicate) edgeLanternEvents.push(ev);
        }

        const nextNode = graph.nodes[nextId];
        if (!nextNode) continue;

        const currentKind = String(node.kind || '').trim().toLowerCase();
        const nextKind = String(nextNode.kind || '').trim().toLowerCase();
        const hasExplicitLanternNode = currentKind === 'lantern' || nextKind === 'lantern';
        const shouldCheckTurnHere = !hasExplicitLanternNode || currentKind === 'lantern';

        const turnLantern = shouldCheckTurnHere
          ? (chosen.color || passSlotEvents[0]?.color || pass.list[0] || null)
          : null;

        const turnLanternColor = normalizeColor(turnLantern);
        const explicitTurnRule = turnLanternColor
          ? constraints.turnRules.get(turnLanternColor) || null
          : null;

        if (
          !constraints.allowImmediateBacktrack &&
          current.heading &&
          dir === OPPOSITE[current.heading] &&
          explicitTurnRule !== 'B'
        ) {
          continue;
        }

        if (!passesTurnRule(node, current.heading, dir, constraints, turnLantern)) continue;

        const nextEnabledDirs = getEnabledDirSet(nextNode);
        if (!nextEnabledDirs.has(OPPOSITE[dir])) continue;

        const nextProgress = applyVisit(current.progress, nextNode, constraints, {
          edgeLanternEvents,
        });
        if (!nextProgress) continue;

        const nextState = {
          nodeId: nextId,
          heading: dir,
          progress: nextProgress,
          steps: current.steps + 1,
        };

        out.push({
          state: nextState,
          move: {
            dir,
            lantern: chosen.color,
            lanternRef: chosen.ref,
            lanternSlot: chosen.slotId || slotIdForEdge || null,
            lanterns: candidateLanternList,
            lanternRefs: candidateLanternRefs,
            passLanterns: pass.list,
            passLanternRefs: pass.refs,
            passLanternSlots: passSlotIds,
            from: current.nodeId,
            to: nextId,
          },
        });
      }
    }
  }

  return out;
}

function parseSimulationOptions(query, constraints) {
  const q = query && typeof query === 'object' ? query : {};
  const sim = (q.simulation && typeof q.simulation === 'object') ? q.simulation : {};

  const initialHeading = normalizeDirList(
    sim.initialHeading || sim.initialDir || q.initialHeading || q.initialDir || q.heading || []
  )[0] || null;

  const maxMovesRaw = Number(
    sim.maxMoves ?? q.maxMoves ?? q.maxSteps ?? constraints.maxSteps ?? 120
  );
  const maxMoves = Number.isFinite(maxMovesRaw) && maxMovesRaw >= 0
    ? Math.floor(maxMovesRaw)
    : (Number.isFinite(Number(constraints.maxSteps)) ? Number(constraints.maxSteps) : 120);

  const stopOnLoop = (sim.stopOnLoop ?? q.stopOnLoop) !== false;

  const stopAtEndRaw = sim.stopAtEnd ?? q.stopAtEnd;
  const stopAtEnd = stopAtEndRaw === undefined
    ? !!constraints.endId
    : stopAtEndRaw !== false;

  return {
    initialHeading,
    maxMoves,
    stopOnLoop,
    stopAtEnd,
  };
}

function runSimulation(graph, constraints, startProgress, query, warnings = []) {
  const sim = parseSimulationOptions(query, constraints);

  const path = {
    nodes: [constraints.startId],
    moves: [],
    edges: [],
    moveCount: 0,
    steps: 0,
  };

  let state = {
    nodeId: constraints.startId,
    heading: sim.initialHeading,
    progress: startProgress,
    steps: 0,
  };

  const seen = new Set();
  seen.add(makeStateKey(state.nodeId, state.heading, state.progress));

  let explored = 0;
  let stopReason = 'maxMovesReached';

  while (path.moves.length < sim.maxMoves) {
    if (sim.stopAtEnd && constraints.endId && state.nodeId === constraints.endId) {
      stopReason = 'endReached';
      break;
    }

    const transitions = buildNextTransitions(state, graph, constraints, {
      useDirPriority: true,
    });
    explored += 1;

    if (!transitions.length) {
      stopReason = 'deadEnd';
      break;
    }

    // Deterministic simulation: take the first valid transition under current rules.
    const chosen = transitions[0];
    state = chosen.state;

    path.nodes.push(state.nodeId);
    path.moves.push(chosen.move.dir || '?');
    path.edges.push(chosen.move);

    if (sim.stopOnLoop) {
      const key = makeStateKey(state.nodeId, state.heading, state.progress);
      if (seen.has(key)) {
        stopReason = 'loopDetected';
        break;
      }
      seen.add(key);
    }
  }

  if (path.moves.length >= sim.maxMoves) {
    stopReason = 'maxMovesReached';
  }

  path.moveCount = path.moves.length;
  path.steps = countRoomTransitionSteps(path, graph);

  const summary = summarizePath(path, graph);

  return {
    success: true,
    mode: 'simulation',
    startId: constraints.startId,
    endId: constraints.endId || null,
    exploredStates: explored,
    path,
    stopReason,
    simulation: sim,
    ...summary,
    ...(warnings.length ? { warnings } : {}),
  };
}

function isGoal(state, constraints) {
  if (constraints.endId && state.nodeId !== constraints.endId) return false;
  if (state.steps < constraints.minSteps) return false;

  if (constraints.requiredRoomMask !== 0n && state.progress.roomMask !== constraints.requiredRoomMask) {
    return false;
  }

  if (
    constraints.mustVisitNodesInOrder.length > 0 &&
    state.progress.nodeOrderIndex < constraints.mustVisitNodesInOrder.length
  ) {
    return false;
  }

  if (constraints.letterMode !== 'any') {
    if (state.progress.letterIndex < constraints.orderedLetters.length) return false;
  } else {
    for (let i = 0; i < constraints.letterTargets.length; i += 1) {
      if (state.progress.letterCounts[i] < constraints.letterTargets[i]) return false;
    }
  }

  if (
    constraints.orderedColors.length > 0 &&
    state.progress.lanternIndex < constraints.orderedColors.length
  ) {
    return false;
  }

  if (constraints.startColor && !state.progress.firstLanternSeen) {
    return false;
  }

  if (
    constraints.requiredLanternRefMask !== 0n &&
    state.progress.lanternRefMask !== constraints.requiredLanternRefMask
  ) {
    return false;
  }

  if (
    constraints.orderedLanternRefs.length > 0 &&
    state.progress.lanternRefOrderIndex < constraints.orderedLanternRefs.length
  ) {
    return false;
  }

  return true;
}

function encodeProgress(progress) {
  const countsPart = progress.letterCounts.length ? progress.letterCounts.join('.') : '-';
  return [
    progress.roomMask.toString(36),
    progress.nodeOrderIndex,
    progress.letterIndex,
    countsPart,
    progress.lanternIndex,
    progress.firstLanternSeen ? 1 : 0,
    progress.lanternRefMask.toString(36),
    progress.lanternRefOrderIndex,
    progress.visitedNodeMask.toString(36),
    progress.lastLanternRef || '-',
  ].join('|');
}

function makeStateKey(nodeId, heading, progress) {
  return `${nodeId}#${heading || '_'}#${encodeProgress(progress)}`;
}

function reconstructPath(goalKey, parentByKey, stateByKey) {
  const nodes = [];
  const moves = [];
  const edges = [];

  let key = goalKey;
  while (key) {
    const state = stateByKey.get(key);
    if (!state) break;

    nodes.push(state.nodeId);
    const parent = parentByKey.get(key);
    if (!parent) break;

    const move = parent.move;
    if (typeof move === 'string') {
      moves.push(move);
      edges.push({ dir: move });
    } else if (move && typeof move === 'object') {
      moves.push(move.dir || '?');
      edges.push(move);
    } else {
      moves.push('?');
      edges.push({ dir: '?' });
    }

    key = parent.prev;
  }

  nodes.reverse();
  moves.reverse();
  edges.reverse();

  const moveCount = Math.max(0, nodes.length - 1);
  return { nodes, moves, edges, moveCount, steps: moveCount };
}

function isRoomKind(kindRaw) {
  const kind = String(kindRaw || '').trim().toLowerCase();
  return kind === 'room' || kind === 'room-center';
}

function countRoomTransitionSteps(path, graph) {
  const edges = Array.isArray(path?.edges) ? path.edges : [];

  if (edges.length) {
    let count = 0;
    for (const edge of edges) {
      const fromNode = edge?.from ? graph.nodes[edge.from] : null;
      const toNode = edge?.to ? graph.nodes[edge.to] : null;
      if (isRoomKind(fromNode?.kind) || isRoomKind(toNode?.kind)) {
        count += 1;
      }
    }
    return count;
  }

  const nodes = Array.isArray(path?.nodes) ? path.nodes : [];
  let count = 0;
  for (let i = 1; i < nodes.length; i += 1) {
    const fromNode = graph.nodes[nodes[i - 1]];
    const toNode = graph.nodes[nodes[i]];
    if (isRoomKind(fromNode?.kind) || isRoomKind(toNode?.kind)) {
      count += 1;
    }
  }
  return count;
}

function summarizePath(path, graph) {
  const lettersPassed = [];
  const lanternsPassed = [];

  for (const nodeId of path.nodes) {
    const node = graph.nodes[nodeId];
    if (!node) continue;

    if (node.letter) {
      lettersPassed.push({ node: nodeId, letter: node.letter });
    }
    if (node.lantern) {
      lanternsPassed.push({
        type: 'node',
        node: nodeId,
        color: node.lantern,
        ref: normalizeRef(node.lanternRef || null),
      });
    }
  }

  for (const edge of path.edges || []) {
    if (!edge) continue;

    let primary = normalizeColor(edge.lantern);
    let primaryRef = normalizeRef(edge.lanternRef || null);
    const primarySlot = normalizeRef(edge.lanternSlot || null);

    if (!primary && primarySlot && graph.lanternSlots && graph.lanternSlots[primarySlot]) {
      const slot = graph.lanternSlots[primarySlot];
      primary = normalizeColor(slot.color || slot.lantern || null);
      primaryRef = normalizeRef(slot.ref || slot.id || primarySlot) || primarySlot;
    }

    if (primary) {
      lanternsPassed.push({
        type: 'edge',
        from: edge.from || null,
        to: edge.to || null,
        dir: edge.dir || null,
        color: primary,
        ref: primaryRef,
        slot: primarySlot,
      });
    }

    const passSlotIds = normalizeRefList(edge.passLanternSlots || []);
    for (const slotId of passSlotIds) {
      const slot = graph.lanternSlots && graph.lanternSlots[slotId];
      const color = normalizeColor(slot && (slot.color || slot.lantern));
      if (!color) continue;
      lanternsPassed.push({
        type: 'pass',
        from: edge.from || null,
        to: edge.to || null,
        dir: edge.dir || null,
        color,
        ref: normalizeRef(slot.ref || slot.id || slotId) || slotId,
        slot: slotId,
      });
    }

    const pass = normalizeLanternListWithRefs(
      edge.passLanterns || [],
      edge.passLanternRefs || []
    );

    for (let i = 0; i < pass.list.length; i += 1) {
      lanternsPassed.push({
        type: 'pass',
        from: edge.from || null,
        to: edge.to || null,
        dir: edge.dir || null,
        color: pass.list[i],
        ref: pass.refs[i] || null,
      });
    }
  }

  return { lettersPassed, lanternsPassed };
}

function unmetConstraintsSummary(constraints, state) {
  const unmet = [];

  if (constraints.endId && state.nodeId !== constraints.endId) {
    unmet.push(`did not end at ${constraints.endId}`);
  }

  if (constraints.requiredRoomMask !== 0n && state.progress.roomMask !== constraints.requiredRoomMask) {
    const missingRooms = constraints.mustUseRooms.filter((roomId) => {
      const bit = constraints.roomBit.get(roomId);
      return bit && (state.progress.roomMask & bit) === 0n;
    });
    if (missingRooms.length) {
      unmet.push(`missing required rooms: ${missingRooms.join(', ')}`);
    }
  }

  if (
    constraints.mustVisitNodesInOrder.length > 0 &&
    state.progress.nodeOrderIndex < constraints.mustVisitNodesInOrder.length
  ) {
    unmet.push(
      `node-order incomplete: ${constraints.mustVisitNodesInOrder
        .slice(state.progress.nodeOrderIndex)
        .join(' → ')}`
    );
  }

  if (constraints.letterMode !== 'any') {
    if (state.progress.letterIndex < constraints.orderedLetters.length) {
      const remaining = constraints.orderedLetters.slice(state.progress.letterIndex).join(' → ');
      const modeLabel =
        constraints.letterMode === 'ordered-strict'
          ? 'ordered letters (strict)'
          : 'ordered letters';
      unmet.push(`${modeLabel} incomplete: ${remaining}`);
    }
  } else {
    const missing = [];
    for (let i = 0; i < constraints.letterKeys.length; i += 1) {
      const have = state.progress.letterCounts[i];
      const need = constraints.letterTargets[i];
      if (have < need) missing.push(`${constraints.letterKeys[i]} (${have}/${need})`);
    }
    if (missing.length) {
      unmet.push(`letter requirements incomplete: ${missing.join(', ')}`);
    }
  }

  if (
    constraints.orderedColors.length > 0 &&
    state.progress.lanternIndex < constraints.orderedColors.length
  ) {
    unmet.push(
      `lantern sequence incomplete: ${constraints.orderedColors
        .slice(state.progress.lanternIndex)
        .join(' → ')}`
    );
  }

  if (constraints.startColor && !state.progress.firstLanternSeen) {
    unmet.push(`never encountered first lantern color: ${constraints.startColor}`);
  }

  if (
    constraints.requiredLanternRefMask !== 0n &&
    state.progress.lanternRefMask !== constraints.requiredLanternRefMask
  ) {
    const missingRefs = constraints.mustUseLanternRefs.filter((ref) => {
      const bit = constraints.lanternRefBit.get(ref);
      return bit && (state.progress.lanternRefMask & bit) === 0n;
    });
    if (missingRefs.length) {
      unmet.push(`missing required lantern refs: ${missingRefs.join(', ')}`);
    }
  }

  if (
    constraints.orderedLanternRefs.length > 0 &&
    state.progress.lanternRefOrderIndex < constraints.orderedLanternRefs.length
  ) {
    unmet.push(
      `lantern ref order incomplete: ${constraints.orderedLanternRefs
        .slice(state.progress.lanternRefOrderIndex)
        .join(' → ')}`
    );
  }

  if (state.steps < constraints.minSteps) {
    unmet.push(`minimum steps not reached (${state.steps}/${constraints.minSteps})`);
  }

  return unmet;
}

function solve(map, query) {
  const q = query && typeof query === 'object' ? query : {};
  const modeRaw = String(q.mode || q.runMode || '').trim().toLowerCase();
  const simulationMode =
    modeRaw.startsWith('sim') ||
    q.simulation === true ||
    (q.simulation && typeof q.simulation === 'object');

  const graph = buildGraph(map);
  const constraints = buildConstraints(q, graph);

  if (!constraints.startId || !graph.nodes[constraints.startId]) {
    throw new Error(`startId "${constraints.startId}" is not a valid node`);
  }
  if (constraints.endId && !graph.nodes[constraints.endId]) {
    throw new Error(`endId "${constraints.endId}" is not a valid node`);
  }

  for (const nodeId of constraints.mustVisitNodesInOrder || []) {
    if (!graph.nodes[nodeId]) {
      throw new Error(`mustVisitNodesInOrder contains invalid node "${nodeId}"`);
    }
  }

  const baseProgress = {
    roomMask: 0n,
    nodeOrderIndex: 0,
    letterIndex: 0,
    letterCounts: new Array(constraints.letterTargets.length).fill(0),
    lanternIndex: 0,
    firstLanternSeen: false,
    lanternRefMask: 0n,
    lanternRefOrderIndex: 0,
    visitedNodeMask: 0n,
    lastLanternRef: null,
  };

  const warnings = [];
  if (!constraints.noRevisitNodes) {
    warnings.push('simplePath is false; node revisits/circuits are allowed.');
  }

  const startNode = graph.nodes[constraints.startId];
  const startProgress = applyVisit(baseProgress, startNode, constraints);
  if (!startProgress) {
    return {
      success: false,
      error: 'Start node violates lantern constraints.',
      startId: constraints.startId,
      endId: constraints.endId,
      ...(warnings.length ? { warnings } : {}),
    };
  }

  if (simulationMode) {
    return runSimulation(graph, constraints, startProgress, q, warnings);
  }

  const queue = [];
  let head = 0;

  const visited = new Set();
  const parentByKey = new Map();
  const stateByKey = new Map();

  let bestState = null;

  function enqueue(state, prevKey = null, move = null) {
    const key = makeStateKey(state.nodeId, state.heading, state.progress);
    if (visited.has(key)) return;

    visited.add(key);
    stateByKey.set(key, state);
    if (prevKey !== null && move !== null) {
      parentByKey.set(key, { prev: prevKey, move });
    }
    queue.push({ ...state, key });

    if (!bestState || state.steps > bestState.steps) {
      bestState = state;
    }
  }

  enqueue({
    nodeId: constraints.startId,
    heading: null,
    progress: startProgress,
    steps: 0,
  });

  let explored = 0;
  let goalKey = null;

  while ((constraints.searchMode === 'dfs' ? queue.length > 0 : head < queue.length) && explored < constraints.maxStates) {
    const current = constraints.searchMode === 'dfs' ? queue.pop() : queue[head++];
    explored += 1;

    if (isGoal(current, constraints)) {
      goalKey = current.key;
      break;
    }

    if (current.steps >= constraints.maxSteps) continue;

    const transitions = buildNextTransitions(current, graph, constraints);
    for (const t of transitions) {
      enqueue(t.state, current.key, t.move);
    }
  }

  if (!goalKey) {
    const fallbackState =
      bestState || {
        nodeId: constraints.startId,
        steps: 0,
        progress: startProgress,
      };

    return {
      success: false,
      startId: constraints.startId,
      endId: constraints.endId,
      exploredStates: explored,
      cappedByMaxStates: explored >= constraints.maxStates,
      message: 'No valid path found with current constraints.',
      unmet: unmetConstraintsSummary(constraints, fallbackState),
      ...(warnings.length ? { warnings } : {}),
    };
  }

  const path = reconstructPath(goalKey, parentByKey, stateByKey);
  path.steps = countRoomTransitionSteps(path, graph);
  path.moveCount = Number.isFinite(Number(path.moveCount))
    ? Number(path.moveCount)
    : Math.max(0, (Array.isArray(path.nodes) ? path.nodes.length : 0) - 1);

  const summary = summarizePath(path, graph);

  return {
    success: true,
    startId: constraints.startId,
    endId: constraints.endId,
    exploredStates: explored,
    path,
    ...summary,
    ...(warnings.length ? { warnings } : {}),
  };
}

export { solve };
